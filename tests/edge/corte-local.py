"""Valida a virada da escrita pública no Supabase local com um provedor simulado."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
import json
import os
from pathlib import Path
import secrets
import shlex
import subprocess
import sys
from threading import Barrier
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import ProxyHandler, Request, build_opener
from uuid import UUID, uuid4


RAIZ = Path(__file__).resolve().parents[2]
MIGRACAO = RAIZ / "supabase/migrations/20261120000500_fechar_insert_publico.sql"
PROFISSIONAIS = [UUID(int=i) for i in (1, 2)]
HTTP_LOCAL = build_opener(ProxyHandler({}))


def ambiente_local(arquivo):
    valores = {}
    for linha in arquivo.read_text().splitlines():
        chave, separador, valor = linha.partition("=")
        if separador:
            valores[chave] = shlex.split(valor)[0]
    for chave in ("API_URL", "DB_URL"):
        destino = urlsplit(valores[chave])
        if destino.hostname not in ("localhost", "127.0.0.1", "::1") or destino.query or destino.fragment:
            raise SystemExit("Use somente URLs locais do stack descartável, sem parâmetros.")
    return valores


def executar(arquivo, exigir_graphql=False):
    env = ambiente_local(arquivo)
    publica = env.get("PUBLISHABLE_KEY") or env["ANON_KEY"]
    assert not publica.startswith("sb_secret_")
    pgenv = {k: v for k, v in os.environ.items() if k not in ("PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS")}

    def sql(comando):
        return subprocess.run(
            ["psql", "-X", "-Atq", "-v", "ON_ERROR_STOP=1", env["DB_URL"]],
            input=comando, text=True, capture_output=True, env=pgenv, check=True
        ).stdout.strip()

    def http(caminho, metodo="POST", corpo=None, sessao=None, headers=None):
        cabecalhos = {"apikey": publica, "content-type": "application/json", **(headers or {})}
        if sessao:
            cabecalhos["Authorization"] = "Bearer " + sessao
        pedido = Request(env["API_URL"] + caminho, headers=cabecalhos, method=metodo,
                         data=json.dumps(corpo).encode() if corpo is not None else None)
        try:
            with HTTP_LOCAL.open(pedido, timeout=20) as resposta:
                status, bruto = resposta.status, resposta.read()
        except HTTPError as erro:
            status, bruto = erro.code, erro.read()
        try:
            return status, json.loads(bruto) if bruto else None
        except ValueError:
            return status, None

    assert sql("""select exists (
        select from pg_policy where polrelid = 'public.agendamentos'::regclass and polname = 'criar_reserva_publica'
    ) and not exists (select from public.agendamentos)
      and not exists (select from barberbook_private.instalacao);""") == "t", "Use um stack descartável na versão anterior ao corte"
    sql((RAIZ / "supabase/configuracao/instalacao.exemplo.sql").read_text(encoding="utf-8"))
    for i, profissional in enumerate(PROFISSIONAIS, 1):
        sql(f"insert into public.barbeiros(id,nome) values ('{profissional}','Equipe fictícia {i}');")
    dia = date.fromisoformat(sql("select (statement_timestamp() at time zone fuso)::date + 1 from barberbook_private.instalacao;"))
    if dia.weekday() == 6:
        dia += timedelta(days=1)

    agenda = "/rest/v1/agendamentos"
    disponibilidade = "/rest/v1/rpc/horarios_elegiveis"
    edge = "/functions/v1/criar-reserva"
    graphql = "/graphql/v1"

    def dados(hora, profissional=0, servico="Barba"):
        return dict(nome="Pessoa fictícia", whatsapp="21900000000", servico=servico,
                    data=str(dia), horario=hora, barbeiro_id=str(PROFISSIONAIS[profissional]))

    def desafio(reserva, chave=None):
        return {**reserva, "chave": chave or str(uuid4()), "token": str(uuid4())}

    sessoes = {}
    for perfil in ("sem-perfil", "barbeiro", "admin"):
        credencial = {"email": f"{perfil}-{uuid4().hex}@example.test", "password": secrets.token_urlsafe(28)}
        status, conta = http("/auth/v1/signup", corpo=credencial)
        assert status == 200
        if perfil != "sem-perfil":
            barbeiro = f"'{PROFISSIONAIS[0]}'" if perfil == "barbeiro" else "null"
            sql(f"insert into barberbook_private.perfis(user_id,papel,barbeiro_id)"
                f" values ('{UUID(conta['user']['id'])}','{perfil}',{barbeiro});")
        status, login = http("/auth/v1/token?grant_type=password", corpo=credencial)
        assert status == 200
        sessoes[perfil] = login["access_token"]

    assert http(agenda, corpo=dados("09:00")) == (201, None)
    antes = sql("select md5(jsonb_agg(to_jsonb(a) order by id)::text) from public.agendamentos a;")
    inspecionar_graphql = {"query": "{ __schema { mutationType { fields { name } } } }"}
    status_gql, corpo_gql = http(graphql, corpo=inspecionar_graphql, sessao=sessoes["admin"])
    introspeccao = status_gql == 200 and bool((corpo_gql or {}).get("data"))
    status_query, consulta_gql = http(graphql, corpo={"query": "{ __typename }"}, sessao=sessoes["admin"])
    graphql_disponivel = status_query == 200 and bool((consulta_gql or {}).get("data"))
    if exigir_graphql:
        assert graphql_disponivel and introspeccao, "O endpoint GraphQL local deve responder à introspecção."
    campos = ((corpo_gql or {}).get("data") or {}).get("__schema", {}).get("mutationType") or {}
    mutacao = next((campo["name"] for campo in campos.get("fields", [])
                    if campo["name"].lower() == "insertintoagendamentoscollection"),
                   "insertIntoagendamentosCollection")

    sql(MIGRACAO.read_text(encoding="utf-8"))
    assert sql("select md5(jsonb_agg(to_jsonb(a) order by id)::text) from public.agendamentos a;") == antes
    print("Corte aplicado em instalação com reserva fictícia. Registro preservado.")

    for sessao in [None, *sessoes.values()]:
        for cabecalhos in ({}, {"Prefer": "resolution=merge-duplicates,return=representation"}):
            status, erro = http(agenda, corpo=dados("09:30"), sessao=sessao, headers=cabecalhos)
            assert status in (401, 403) and erro["code"] == "42501", status
        for nome, parametros in (("admitir_tentativa", {"p_origem": None}), ("confirmar_reserva", {})):
            for cabecalhos in ({}, {"Content-Profile": "barberbook_reservas"}):
                status, erro = http("/rest/v1/rpc/" + nome, corpo=parametros, sessao=sessao, headers=cabecalhos)
                assert status in (401, 403, 404, 406), status
        if graphql_disponivel:
            if introspeccao:
                status, esquema = http(graphql, corpo=inspecionar_graphql, sessao=sessao)
                assert status == 200 and (esquema or {}).get("data"), status
                campos = esquema["data"]["__schema"]["mutationType"] or {}
                assert all(not (campo["name"].lower().startswith("insertinto") and
                                "agendamentos" in campo["name"].lower()) for campo in campos.get("fields", []))
            registro = ", ".join(f"{campo}: {json.dumps(valor)}" for campo, valor in dados("09:30").items())
            consulta = f"mutation {{ {mutacao}(objects: [{{{registro}}}]) {{ affectedCount }} }}"
            status, retorno = http(graphql, corpo={"query": consulta}, sessao=sessao)
            assert status in (200, 400, 401, 403) and (retorno or {}).get("errors"), status
    assert sql("select count(*) from public.agendamentos;") == "1"
    print("REST e RPC recusaram a escrita direta para os quatro perfis.")
    print("GraphQL disponível e mutação recusada." if graphql_disponivel
          else f"GraphQL não disponível neste stack (HTTP {status_query} na consulta de teste).")

    status, horarios = http(disponibilidade, corpo={
        "p_servico": "Barba", "p_barbeiro_id": str(PROFISSIONAIS[0]), "p_data": str(dia)
    })
    assert status == 200 and set(horarios) == {"total", "horarios"} and "09:00" not in horarios["horarios"]
    assert "09:30" in horarios["horarios"]
    assert http(agenda + "?select=nome,whatsapp", "GET")[0] in (401, 403)
    assert http(agenda + "?select=id", "GET", sessao=sessoes["sem-perfil"]) == (200, [])
    status, registros = http(agenda + "?select=id", "GET", sessao=sessoes["barbeiro"])
    assert status == 200 and len(registros) == 1
    assert http(agenda + f"?id=eq.{registros[0]['id']}", "PATCH", {"nome": "Contato fictício atualizado"},
                sessoes["barbeiro"])[0] == 204
    assert http("/rest/v1/datas_bloqueadas", corpo={"data": str(dia + timedelta(days=20))},
                sessao=sessoes["admin"])[0] == 201
    print("Horários públicos sem dados pessoais e operações autorizadas do painel preservadas.")

    anterior = desafio(dados("10:00"))
    # O cliente de teste descarta a primeira confirmação para simular a perda da resposta após o commit.
    http(edge, corpo=anterior)
    assert sql("select count(*) from public.agendamentos;") == "2"
    repeticao = desafio(dados("10:00"), anterior["chave"])
    assert http(edge, corpo=repeticao) == (201, {"resultado": "confirmada"})
    assert http(edge, corpo=repeticao) == (400, {"resultado": "token_invalido"})
    assert http(edge, corpo=desafio(dados("10:30"), anterior["chave"])) == (409, {"resultado": "chave_incompativel"})
    partida = Barrier(2)

    def disputar(reserva):
        partida.wait(timeout=10)
        return http(edge, corpo=desafio(reserva))

    with ThreadPoolExecutor(max_workers=2) as executor:
        respostas = list(executor.map(disputar, [dados("13:00", 1, "Corte com tesoura"), dados("13:30", 1)]))
    assert sorted(status for status, _ in respostas) == [201, 409]
    assert next(r for codigo, r in respostas if codigo == 409) == {"resultado": "conflito"}
    assert sql("select count(*) from public.agendamentos;") == "3"
    assert http(agenda + f"?id=eq.{registros[0]['id']}", "DELETE", sessao=sessoes["admin"])[0] == 204
    assert sql("select count(*) from public.agendamentos;") == "2"
    print("Edge pós-corte confirmou escrita, idempotência, uso único de token e concorrência por intervalo.")


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] != "--exigir-graphql"):
        raise SystemExit("Uso: corte-local.py status.env [--exigir-graphql]")
    executar(Path(sys.argv[1]), exigir_graphql=len(sys.argv) == 3)
