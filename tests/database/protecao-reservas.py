"""Regressões do controle de reservas em um PostgreSQL local descartável."""

from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import re
import subprocess
from threading import Barrier


PASTA = Path(__file__).resolve().parent
ESQUEMA = "barberbook_reservas"
PAPEL = "barberbook_edge_exec"
ASSINATURA = f"{ESQUEMA}.confirmar_reserva(bytea,bytea,bytea,bytea,text,text,text,date,time,uuid)"
HOJE = "(statement_timestamp() at time zone 'America/Sao_Paulo')::date"
AMBIENTE = {chave: valor for chave, valor in os.environ.items()
            if chave not in ("PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS")}


def cliente(*args, comando=None, verificar=True):
    return subprocess.run(["psql", "-X", "-Atq", "-v", "ON_ERROR_STOP=1", *args],
                          input=comando, text=True, capture_output=True,
                          env=AMBIENTE, check=verificar)


def sql(comando):
    return cliente(comando=comando).stdout.strip()


def resumo(rotulo):
    # As entradas deste roteiro são literais fictícios, sem dados externos.
    return f"sha256(convert_to('{rotulo}', 'UTF8'))"


def admitir(origem):
    digest = resumo(origem) if origem else "null"
    return int(sql(f"set role {PAPEL}; select {ESQUEMA}.admitir_tentativa({digest});"))


def pedido(chave, token, *, contato=None, dia=1, hora="09:00",
           profissional=1, nome="Cliente fictício", servico="Corte teste"):
    digests = ", ".join(map(resumo, (chave, "prova-" + chave, token, contato or "contato-" + chave)))
    return f"""
        set role {PAPEL};
        select {ESQUEMA}.confirmar_reserva({digests},
            '{nome}', '21900000000', '{servico}', {HOJE} + {dia}, '{hora}',
            '10000000-0000-4000-8000-00000000000{profissional}');
    """


def confirmar(*args, **opcoes):
    return json.loads(sql(pedido(*args, **opcoes)))


def em_paralelo(funcoes):
    partida = Barrier(len(funcoes))

    def executar(funcao):
        partida.wait(timeout=10)
        return funcao()

    with ThreadPoolExecutor(max_workers=len(funcoes)) as pool:
        return [futuro.result() for futuro in [pool.submit(executar, f) for f in funcoes]]


def teste():
    if not (AMBIENTE.get("PGHOST", "").startswith("/") or
            AMBIENTE.get("PGHOST") in {"127.0.0.1", "::1"}):
        raise SystemExit("Configure PGHOST com um socket Unix ou loopback.")
    if not re.fullmatch(r"barberbook_test_[a-z0-9_]+", AMBIENTE.get("PGDATABASE", "")):
        raise SystemExit("Use um banco descartável com prefixo barberbook_test_.")
    cliente("-f", str(PASTA / "fixtures.sql"))
    insert_esperado = sql("""select exists (
        select 1 from pg_policy where polrelid = 'public.agendamentos'::regclass
          and polname = 'criar_reserva_publica'
    )""") == "t"

    for papel in ["anon", "authenticated", "service_role"]:
        assert sql(f"""select not has_schema_privilege('{papel}', '{ESQUEMA}', 'USAGE')
                              and not has_function_privilege('{papel}', '{ASSINATURA}', 'EXECUTE')
                              and not has_function_privilege('{papel}', '{ESQUEMA}.admitir_tentativa(bytea)', 'EXECUTE')""") == "t"
    assert sql(f"""select not exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where n.nspname = '{ESQUEMA}' and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    )""") == "t"
    assert sql(f"""select has_function_privilege('{PAPEL}', '{ASSINATURA}', 'EXECUTE')
        and not has_function_privilege('{PAPEL}', '{ESQUEMA}.limpar_expirados(integer)', 'EXECUTE')
        and not has_column_privilege('{PAPEL}', 'public.agendamentos', 'nome', 'SELECT')
        and not has_column_privilege('{PAPEL}', 'public.agendamentos', 'whatsapp', 'SELECT')
        and not has_column_privilege('{PAPEL}', 'public.agendamentos', 'nome', 'INSERT')
        and not has_table_privilege('{PAPEL}', '{ESQUEMA}.pedidos', 'SELECT')
        and has_any_column_privilege('anon', 'public.agendamentos', 'INSERT') = {str(insert_esperado).lower()}
        and has_any_column_privilege('authenticated', 'public.agendamentos', 'INSERT') = {str(insert_esperado).lower()}""") == "t"
    for tabela in ["public.agendamentos", f"{ESQUEMA}.pedidos"]:
        negada = cliente(comando=f"\\set VERBOSITY verbose\nset role {PAPEL}; select * from {tabela};",
                         verificar=False)
        assert negada.returncode and "42501" in negada.stderr
    print(f"ACLs, chamada restrita e estado do INSERT público conferidos (ativo={insert_esperado}).")

    sql(f"""update {ESQUEMA}.configuracao set tentativas_global = 7, tentativas_origem = 4,
        janela_tentativas_segundos = 86400, reservas_contato = 4, janela_reservas_segundos = 86400;""")
    origens = em_paralelo([lambda: admitir("origem fictícia A")] * 9)
    assert origens.count(0) == 4 and sum(r > 0 for r in origens) == 5
    globais = em_paralelo([lambda i=i: admitir(f"origem fictícia {i}") for i in range(8)])
    assert globais.count(0) == 3 and sum(r > 0 for r in globais) == 5
    print("Cotas concorrentes por origem e global aceitaram exatamente N.")

    repeticao = em_paralelo([lambda i=i: confirmar(f"token-r{i}", "token comum", profissional=i)
                            for i in (1, 2)])
    assert sorted(r["resultado"] for r in repeticao) == ["confirmada", "token_reutilizado"]
    iguais = em_paralelo([lambda i=i: confirmar("pedido igual", f"token igual {i}", dia=2)
                         for i in (1, 2)])
    assert iguais == [{"resultado": "confirmada"}] * 2
    assert confirmar("pedido igual", "token outro", dia=2, nome="Outro cliente fictício") == {
        "resultado": "chave_incompativel"}
    assert confirmar("pedido igual", "token sem prova", dia=2, hora="10:00") == {
        "resultado": "chave_incompativel"}
    assert sql("select count(*) from public.agendamentos") == "2"
    print("Token concorrente e idempotência com mesmo pedido ou conteúdo diferente passaram.")

    sobrepostas = em_paralelo([
        lambda: confirmar("sobreposicao-a", "token sobreposicao-a", dia=5, servico="Barba teste"),
        lambda: confirmar("sobreposicao-b", "token sobreposicao-b", dia=5, hora="09:30"),
    ])
    assert sorted(r["resultado"] for r in sobrepostas) == ["confirmada", "conflito"]
    assert confirmar("servico inativo", "confere defesa", dia=6, servico="Serviço inativo") == {
        "resultado": "invalida"}
    assert confirmar("data bloqueada", "respeita bloqueio", dia=3) == {"resultado": "invalida"}
    assert confirmar("novo pedido", "respeita bloqueio", dia=6) == {"resultado": "token_reutilizado"}
    assert sql(f"select sum(usadas) from {ESQUEMA}.cotas where escopo = 'reservas_global'") == "3"
    print("Gatilhos, exclusão de intervalos e rollback de cota em conflito passaram.")

    sql(f"update {ESQUEMA}.configuracao set reservas_contato = 1")
    contatos = em_paralelo([
        lambda i=i: confirmar(f"contato {i}", f"token contato {i}", dia=6,
                              profissional=i, contato="contato em disputa") for i in (1, 2)
    ])
    assert sorted(r["resultado"] for r in contatos) == ["confirmada", "limitada"]
    assert next(r["tentar_em"] for r in contatos if r["resultado"] == "limitada") > 0
    print("Cota de gravação concorrente por contato passou.")

    sql("""
        create function public.barberbook_teste_falha() returns trigger language plpgsql as $$
        begin raise sqlstate 'BB099' using message = 'Falha fictícia'; end;
        $$;
        create trigger barberbook_teste_falha before insert on public.agendamentos
        for each row execute function public.barberbook_teste_falha();
    """)
    falha = cliente(comando="\\set VERBOSITY verbose\n" + pedido("recuperacao", "token erro", dia=6, hora="10:00"),
                    verificar=False)
    assert falha.returncode and "BB099" in falha.stderr
    assert sql(f"""select not exists (select from {ESQUEMA}.pedidos where resumo = {resumo('recuperacao')})
        and not exists (select from {ESQUEMA}.tokens where resumo = {resumo('token erro')})
        and (select sum(usadas) from {ESQUEMA}.cotas where escopo = 'reservas_global') = 4""") == "t"
    sql("drop trigger barberbook_teste_falha on public.agendamentos; drop function public.barberbook_teste_falha()")
    assert confirmar("recuperacao", "token novo", dia=6, hora="10:00") == {"resultado": "confirmada"}
    assert confirmar("recuperacao", "token após perda", dia=6, hora="10:00") == {"resultado": "confirmada"}
    assert sql("select count(*) from public.agendamentos") == "5"
    print("Falha transacional e recuperação após confirmação sem duplicação passaram.")

    sql(f"""
        update {ESQUEMA}.tokens set expira_em = now() - interval '1 minute' where resumo = {resumo('token comum')};
        update {ESQUEMA}.pedidos set expira_em = now() - interval '1 minute' where resumo = {resumo('pedido igual')};
        update {ESQUEMA}.cotas set expira_em = now() - interval '1 minute' where escopo = 'tentativas_global';
    """)
    assert sql(f"select {ESQUEMA}.limpar_expirados(1)") == "3"
    assert sql(f"select {ESQUEMA}.limpar_expirados(1)") == "0"
    assert sql("select count(*) from public.agendamentos") == "5"
    assert sql(f"select count(*) > 0 from {ESQUEMA}.tokens where expira_em > now()") == "t"
    limitado = next(i for i, r in enumerate(contatos, 1) if r["resultado"] == "limitada")
    sql(f"""update {ESQUEMA}.cotas set expira_em = now() - interval '1 minute'
        where escopo = 'reservas_contato' and resumo = {resumo('contato em disputa')}""")
    assert sql(f"select {ESQUEMA}.limpar_expirados(1)") == "1"
    assert confirmar(f"contato {limitado}", "token após espera", dia=6,
                     profissional=limitado, contato="contato em disputa") == {"resultado": "confirmada"}
    assert sql("select count(*) from public.agendamentos") == "6"
    print("Expiração e limpeza em lote preservaram as reservas e registros ainda válidos.")


if __name__ == "__main__":
    teste()
