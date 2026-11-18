#!/usr/bin/env bash
set -euo pipefail

# Exige um banco descartável e acesso exclusivamente local.
case "${PGHOST:-}" in
    /*|127.0.0.1|::1) ;;
    *) echo "Defina PGHOST como socket Unix local ou loopback." >&2; exit 1 ;;
esac
if [[ ! ${PGDATABASE:-} =~ ^barberbook_test_[a-z0-9_]+$ ]]; then
    echo "Use um banco descartável com prefixo barberbook_test_." >&2
    exit 1
fi
unset PGHOSTADDR PGSERVICE PGSERVICEFILE
cd -- "$(dirname -- "$0")"

psql -X -q -v ON_ERROR_STOP=1 -f fixtures.sql

work=$(mktemp -d)
pid_a=
pid_b=
limpar() {
    touch "$work/liberar"
    if [[ -n $pid_a ]]; then wait "$pid_a" || true; fi
    if [[ -n $pid_b ]]; then wait "$pid_b" || true; fi
    rm -f -- "$work/liberar" "$work/pronto" "$work/a.log" "$work/b.log"
    rmdir -- "$work"
}
trap limpar EXIT

dia="(statement_timestamp() at time zone 'America/Sao_Paulo')::date"
reserva() {
    local deslocamento=$1 horario=$2 barbeiro=$3
    cat <<SQL
set local role anon;
insert into public.agendamentos (nome, whatsapp, servico, data, horario, barbeiro_id)
values ('Reserva fictícia', '21900000000', 'Corte teste', $dia + $deslocamento,
        '$horario', '10000000-0000-4000-8000-00000000000$barbeiro');
SQL
}

correr() {
    local operacao_a=$1 operacao_b=$2 erro_esperado=$3
    local pronto=false esperou=false resultado=0
    rm -f -- "$work/liberar" "$work/pronto"

    PGAPPNAME=barberbook_concorrencia_a psql -X -q -v ON_ERROR_STOP=1 >"$work/a.log" 2>&1 <<SQL &
begin;
$operacao_a
\! touch '$work/pronto'
\! for i in \$(seq 1 150); do [ -f '$work/liberar' ] && break; sleep 0.1; done
commit;
SQL
    pid_a=$!
    for _ in {1..100}; do
        if [[ -f $work/pronto ]]; then pronto=true; break; fi
        sleep 0.05
    done
    if ! "$pronto"; then cat "$work/a.log" >&2; return 1; fi

    PGAPPNAME=barberbook_concorrencia_b psql -X -q -v ON_ERROR_STOP=1 >"$work/b.log" 2>&1 <<SQL &
\set VERBOSITY verbose
begin;
$operacao_b
commit;
SQL
    pid_b=$!
    for _ in {1..100}; do
        if [[ $(psql -X -Atq -v ON_ERROR_STOP=1 -c "
            select exists (
                select 1 from pg_stat_activity
                where datname = current_database() and application_name = 'barberbook_concorrencia_b'
                  and wait_event_type = 'Lock' and wait_event = 'advisory'
            )") == t ]]; then
            esperou=true
            break
        fi
        sleep 0.05
    done
    touch "$work/liberar"
    wait "$pid_a" || { cat "$work/a.log" >&2; return 1; }
    pid_a=
    wait "$pid_b" || resultado=$?
    pid_b=
    if ! "$esperou"; then
        echo "As transações não concorreram pelo lock da agenda." >&2
        cat "$work/b.log" >&2
        return 1
    fi
    if [[ -n $erro_esperado ]]; then
        if [[ $resultado == 0 ]] || ! grep -q -- "$erro_esperado:" "$work/b.log"; then
            cat "$work/b.log" >&2
            return 1
        fi
    elif [[ $resultado != 0 ]]; then
        cat "$work/b.log" >&2
        return 1
    fi
}

correr "$(reserva 1 09:00 1)" "$(reserva 1 09:00 1)" 23505
correr "$(reserva 2 09:30 1)" "$(reserva 2 09:30 2)" ""
correr "set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
insert into public.datas_bloqueadas (data) values ($dia + 5);" "$(reserva 5 09:00 1)" 23514

total=$(psql -X -Atq -v ON_ERROR_STOP=1 -c 'select count(*) from public.agendamentos')
if [[ $total != 3 ]]; then
    echo "Esperadas três reservas após os testes, encontradas $total." >&2
    exit 1
fi
echo "Concorrência passou: mesmo profissional, profissionais distintos e bloqueio versus reserva."
