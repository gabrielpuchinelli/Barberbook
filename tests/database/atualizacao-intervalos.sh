#!/usr/bin/env bash
set -euo pipefail

case "${PGHOST:-}" in
    /*|127.0.0.1|::1) ;;
    *) echo "Use socket Unix local ou loopback." >&2; exit 1 ;;
esac
if [[ ! ${PGDATABASE:-} =~ ^barberbook_test_[a-z0-9_]+$ ]]; then
    echo "Use um banco descartável vazio com prefixo barberbook_test_ e Auth provisionado." >&2
    exit 1
fi
unset PGHOSTADDR PGSERVICE PGSERVICEFILE
cd -- "$(dirname -- "$0")/../.."

migracoes=supabase/migrations
ativar=$migracoes/20261120000200_ativar_intervalos.sql
sql() { psql -X -Atq -v ON_ERROR_STOP=1 "$@"; }

for arquivo in "$migracoes"/20261118*.sql; do sql -f "$arquivo"; done
sql -f tests/database/fixtures.sql

sql <<'SQL'
insert into public.agendamentos (nome, whatsapp, servico, data, horario, barbeiro_id)
select nome, '21900000000', 'Corte teste', (statement_timestamp() at time zone 'America/Sao_Paulo')::date + dias,
    horario, '10000000-0000-4000-8000-000000000001'
from (values ('Legado A', 1, time '09:00'), ('Legado B', 1, time '09:30'), ('Concluído fictício', 2, time '10:00'))
     f(nome, dias, horario);
-- O trigger antigo recusava criar histórico. Cria-se a situação apenas na fixture.
begin;
set local session_replication_role = replica;
update public.agendamentos set data = data - 10 where nome = 'Concluído fictício';
commit;
SQL

sql -f "$migracoes/20261120000100_preparar_intervalos.sql"
if saida=$(sql -c "update barberbook_private.instalacao set fuso = 'Asia/Tokyo'" 2>&1) ||
   [[ $saida != *'O fuso da instalação não pode mudar enquanto houver agendamentos.'* ]]; then
    echo "A preparação deveria proteger o fuso de reservas legadas antes do backfill." >&2
    printf '%s\n' "$saida" >&2
    exit 1
fi
sql <<'SQL'
update barberbook_private.servicos set duracao_minutos = 90;
update barberbook_private.servicos set duracao_minutos = 45 where codigo = 'Barba teste';
insert into barberbook_private.janelas_expediente
select dia, time '09:00', time '11:00' from generate_series(0, 6) dia;
SQL

falhar_ativacao() {
    local motivo=$1 saida
    if saida=$(sql -f "$ativar" 2>&1) || [[ $saida != *"$motivo"* ]]; then
        echo "A ativação deveria abortar por $motivo." >&2
        printf '%s\n' "$saida" >&2
        exit 1
    fi
    [[ $(sql -c 'select count(*) from public.agendamentos where inicio_em is not null or legado_sem_intervalo') == 0 ]]
}

[[ $(sql -c "select count(*) from barberbook_private.diagnostico_intervalos where problema = 'reserva_sem_referencia'") == 3 ]]
falhar_ativacao reserva_sem_referencia

sql <<'SQL'
insert into barberbook_private.referencias_intervalos_legados
    (agendamento_id, duracao_minutos, concluido_sem_duracao, referencia)
select id, case when nome = 'Legado A' then 60 when nome = 'Legado B' then 30 end,
    nome = 'Concluído fictício', 'Ficha fictícia anterior'
from public.agendamentos;
update barberbook_private.referencias_intervalos_legados
set duracao_minutos = null, concluido_sem_duracao = true
where agendamento_id = (select id from public.agendamentos where nome = 'Legado A');
SQL
falhar_ativacao conclusao_sem_inicio_passado_valido
sql <<'SQL'
update barberbook_private.referencias_intervalos_legados
set duracao_minutos = 60, concluido_sem_duracao = false
where agendamento_id = (select id from public.agendamentos where nome = 'Legado A');
SQL
[[ $(sql -c "select count(*) from barberbook_private.diagnostico_intervalos where problema = 'intervalos_legados_sobrepostos'") == 1 ]]
falhar_ativacao intervalos_legados_sobrepostos

sql <<'SQL'
-- Simula a confirmação do tempo efetivamente contratado no primeiro registro.
update barberbook_private.referencias_intervalos_legados set duracao_minutos = 30
where agendamento_id = (select id from public.agendamentos where nome = 'Legado A');
SQL
[[ $(sql -c 'select count(*) from barberbook_private.diagnostico_intervalos') == 0 ]]
sql -f "$ativar"
[[ $(sql -c "select count(*) from public.agendamentos
where nome in ('Legado A', 'Legado B') and not legado_sem_intervalo
  and duracao_minutos = 30 and fim_em - inicio_em = interval '30 minutes' and preco = 'R$ 25,00'") == 2 ]]
[[ $(sql -c "select count(*) from public.agendamentos where nome = 'Concluído fictício'
and legado_sem_intervalo and inicio_em is null and fim_em is null and duracao_minutos is null") == 1 ]]
sql <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
do $$
declare
    historico public.agendamentos;
    depois public.agendamentos;
    nova_data date;
begin
    select * into strict historico from public.agendamentos where legado_sem_intervalo;
    select max(data) into nova_data from public.agendamentos where not legado_sem_intervalo;

    update public.agendamentos set nome = 'Histórico corrigido', whatsapp = '+55 (21) 90000-0001'
    where id = historico.id returning * into strict depois;
    if depois.nome <> 'Histórico corrigido' or depois.whatsapp <> '+5521900000001'
       or not depois.legado_sem_intervalo
       or depois.duracao_minutos is not null or depois.inicio_em is not null or depois.fim_em is not null
       or (depois.servico, depois.preco, depois.data, depois.horario)
          is distinct from (historico.servico, historico.preco, historico.data, historico.horario) then
        raise exception 'A correção de contato alterou os dados do atendimento histórico.';
    end if;

    begin
        update public.agendamentos set data = nova_data, horario = '10:00' where id = historico.id;
        raise exception 'A remarcação aceitou um histórico sem duração.';
    exception when check_violation then
        if sqlerrm <> 'Para remarcar um registro sem duração histórica, selecione um novo serviço.' then raise; end if;
    end;
    begin
        update public.agendamentos set servico = 'Barba teste' where id = historico.id;
        raise exception 'A troca de serviço criou um intervalo em data passada.';
    exception when check_violation then
        if sqlerrm <> 'Horário indisponível.' then raise; end if;
    end;
    begin
        update public.agendamentos set data = nova_data, horario = '10:00', servico = 'Serviço inativo'
        where id = historico.id;
        raise exception 'A remarcação aceitou um serviço inativo.';
    exception when check_violation then
        if sqlerrm <> 'Serviço indisponível.' then raise; end if;
    end;

    if not exists (
        select from public.agendamentos where id = historico.id and legado_sem_intervalo
          and data = historico.data and horario = historico.horario and servico = historico.servico
          and duracao_minutos is null and inicio_em is null and fim_em is null
    ) then
        raise exception 'Uma operação rejeitada alterou o histórico.';
    end if;

    update public.agendamentos set data = nova_data, horario = '10:00', servico = 'Barba teste'
    where id = historico.id returning * into strict depois;
    if depois.legado_sem_intervalo or depois.duracao_minutos is distinct from 45
       or depois.preco is distinct from 'R$ 17,50'
       or depois.inicio_em is distinct from ((nova_data + time '10:00') at time zone 'America/Sao_Paulo')
       or depois.fim_em is distinct from (depois.inicio_em + interval '45 minutes') then
        raise exception 'A remarcação com novo serviço não gravou um intervalo válido.';
    end if;
end;
$$;
rollback;
SQL
[[ $(sql -c 'select count(*) from barberbook_private.diagnostico_intervalos') == 0 ]]
echo "Upgrade passou: diagnóstico, backfill e edição, remarcação e troca de serviço em histórico sem duração."
