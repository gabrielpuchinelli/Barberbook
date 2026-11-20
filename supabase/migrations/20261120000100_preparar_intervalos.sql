begin;

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
-- Encontra a classe GiST de UUID/smallint também se a extensão já estiver em outro schema.
select pg_catalog.set_config('search_path', pg_catalog.format('pg_catalog, %I', n.nspname), true)
from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid = e.extnamespace
where e.extname = 'btree_gist';

alter table barberbook_private.servicos
    add column duracao_minutos smallint check (duracao_minutos between 1 and 1440);

create table barberbook_private.janelas_expediente (
    dia_semana smallint not null check (dia_semana between 0 and 6),
    inicio time without time zone not null check (extract(second from inicio) = 0),
    fim time without time zone not null check (extract(second from fim) = 0),
    check (inicio < fim),
    primary key (dia_semana, inicio),
    exclude using gist (
        dia_semana with =,
        tsrange(date '2000-01-01' + inicio, date '2000-01-01' + fim, '[)') with &&
    )
);

alter table public.agendamentos
    add column duracao_minutos smallint,
    add column inicio_em timestamptz,
    add column fim_em timestamptz,
    add column legado_sem_intervalo boolean not null default false;

-- A referência é preenchida pelo operador. Não copie a duração atual do cartão
-- para reservas anteriores sem confirmação de que era a duração contratada.
create table barberbook_private.referencias_intervalos_legados (
    agendamento_id bigint primary key references public.agendamentos(id) on delete cascade,
    duracao_minutos smallint check (duracao_minutos between 1 and 1440),
    concluido_sem_duracao boolean not null default false,
    referencia text not null check (char_length(btrim(referencia)) between 1 and 240),
    check ((duracao_minutos is null) = concluido_sem_duracao)
);

alter table barberbook_private.janelas_expediente enable row level security;
alter table barberbook_private.referencias_intervalos_legados enable row level security;
revoke all on barberbook_private.janelas_expediente, barberbook_private.referencias_intervalos_legados
    from public, anon, authenticated, service_role;

grant select (duracao_minutos) on barberbook_private.servicos to barberbook_validacao;
grant select (dia_semana, inicio, fim) on barberbook_private.janelas_expediente to barberbook_validacao;
create policy validar_expediente on barberbook_private.janelas_expediente
    for select to barberbook_validacao using (true);

create trigger serializar_agenda before insert or update or delete or truncate
on barberbook_private.janelas_expediente
for each statement execute function barberbook_private.serializar_agenda();

create function barberbook_private.proteger_fuso_da_agenda()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
    -- O trigger de TRUNCATE roda antes de serializar_agenda. Rejeite a operação
    -- sem disputar o lock da agenda já com ACCESS EXCLUSIVE na instalação.
    if tg_op = 'TRUNCATE' then
        raise exception using errcode = '23514', message = 'Use DELETE para remover a configuração da instalação.';
    end if;
    if tg_op = 'UPDATE' and new.fuso is not distinct from old.fuso then
        return new;
    end if;
    -- UPDATE e DELETE passam primeiro pelo lock de serializar_agenda.
    if exists (select 1 from public.agendamentos) then
        raise exception using errcode = '23514', message = 'O fuso da instalação não pode mudar enquanto houver agendamentos.';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

revoke all on function barberbook_private.proteger_fuso_da_agenda()
    from public, anon, authenticated, service_role;
create trigger proteger_fuso before update of fuso or delete on barberbook_private.instalacao
for each row execute function barberbook_private.proteger_fuso_da_agenda();
create trigger proteger_fuso_truncate before truncate on barberbook_private.instalacao
for each statement execute function barberbook_private.proteger_fuso_da_agenda();

create function barberbook_private.instante_civil(dia date, hora time, fuso text)
returns timestamptz
language sql stable strict
set search_path = ''
as $$
    select instante
    from (select (dia + hora) at time zone fuso as instante) conversao
    where (instante at time zone fuso) = dia + hora
      -- A ida e volta detecta lacunas, mas também é válida nas duas ocorrências de uma hora repetida.
      -- Teste os deslocamentos vizinhos sem presumir que a transição seja de uma hora.
      and not exists (
          select 1
          from (values (instante - interval '24 hours'), (instante + interval '24 hours')) amostras(amostra)
          cross join lateral (
              select ((dia + hora) at time zone 'UTC')
                     - ((amostra at time zone fuso) - (amostra at time zone 'UTC'))
          ) teste(alternativa)
          where alternativa <> instante and (alternativa at time zone fuso) = dia + hora
      )
$$;

create function barberbook_private.intervalo_atendimento(dia date, hora time, minutos integer, fuso text)
returns tstzrange
language sql stable strict
set search_path = ''
as $$
    select tstzrange(inicio, fim, '[)')
    from (select barberbook_private.instante_civil(dia, hora, fuso) as inicio) local
    cross join lateral (select inicio + make_interval(mins => minutos) as fim) termino
    where inicio is not null and hora < time '24:00' and minutos between 1 and 1440
      and (((fim - interval '1 microsecond') at time zone fuso)::date = dia)
$$;

revoke all on function barberbook_private.instante_civil(date, time, text),
    barberbook_private.intervalo_atendimento(date, time, integer, text)
    from public, anon, authenticated, service_role;
grant execute on function barberbook_private.instante_civil(date, time, text),
    barberbook_private.intervalo_atendimento(date, time, integer, text)
    to barberbook_validacao;

create view barberbook_private.intervalos_legados_para_migrar as
select a.id, a.barbeiro_id, r.duracao_minutos, coalesce(r.concluido_sem_duracao, false) as concluido,
       barberbook_private.instante_civil(a.data, a.horario, i.fuso) as inicio_civil,
       barberbook_private.intervalo_atendimento(a.data, a.horario, r.duracao_minutos, i.fuso) as intervalo
from public.agendamentos a
left join barberbook_private.referencias_intervalos_legados r on r.agendamento_id = a.id
left join barberbook_private.instalacao i on true
where a.inicio_em is null and not a.legado_sem_intervalo;

create view barberbook_private.diagnostico_intervalos as
select 'servico_sem_duracao'::text as problema, s.codigo as servico,
       null::smallint as dia_semana, null::bigint as agendamento_id, null::bigint as conflito_id
from barberbook_private.servicos s where s.duracao_minutos is null
union all
select 'dia_ativo_sem_expediente', null, d.dia_semana, null, null
from public.dias_disponiveis d
where d.ativo and not exists (
    select from barberbook_private.janelas_expediente j where j.dia_semana = d.dia_semana
)
union all
select case
           when l.concluido then 'conclusao_sem_inicio_passado_valido'
           when l.duracao_minutos is null then 'reserva_sem_referencia'
           else 'intervalo_legado_invalido'
       end, null, null, l.id, null
from barberbook_private.intervalos_legados_para_migrar l
where (l.concluido and (l.inicio_civil is null or l.inicio_civil >= statement_timestamp()))
   or (not l.concluido and l.intervalo is null)
union all
select 'intervalos_legados_sobrepostos', null, null, a.id, b.id
from barberbook_private.intervalos_legados_para_migrar a
join barberbook_private.intervalos_legados_para_migrar b
    on a.id < b.id and a.barbeiro_id = b.barbeiro_id and a.intervalo && b.intervalo;

revoke all on barberbook_private.intervalos_legados_para_migrar, barberbook_private.diagnostico_intervalos
    from public, anon, authenticated, service_role;

commit;
