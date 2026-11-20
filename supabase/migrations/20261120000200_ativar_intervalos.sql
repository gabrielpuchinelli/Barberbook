begin;

-- Execute em manutenção. Evita deixar a aplicação esperando indefinidamente por DDL.
set local lock_timeout = '5s';
lock table public.agendamentos in access exclusive mode;
lock table barberbook_private.instalacao, barberbook_private.servicos,
    barberbook_private.janelas_expediente, barberbook_private.referencias_intervalos_legados,
    public.dias_disponiveis in share row exclusive mode;

do $$
declare
    resumo text;
begin
    select string_agg(problema || '=' || total, ', ' order by problema) into resumo
    from (
        select problema, count(*) as total
        from barberbook_private.diagnostico_intervalos group by problema
    ) pendencias;
    if resumo is not null then
        raise exception using errcode = '23514',
            message = 'Ativação de intervalos interrompida: ' || resumo,
            hint = 'Consulte barberbook_private.diagnostico_intervalos antes de repetir.';
    end if;
end;
$$;

update public.agendamentos a
set duracao_minutos = l.duracao_minutos,
    inicio_em = lower(l.intervalo),
    fim_em = upper(l.intervalo),
    legado_sem_intervalo = l.concluido
from barberbook_private.intervalos_legados_para_migrar l
where a.id = l.id;

alter table barberbook_private.servicos alter column duracao_minutos set not null;

select pg_catalog.set_config('search_path', pg_catalog.format('pg_catalog, %I', n.nspname), true)
from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid = e.extnamespace
where e.extname = 'btree_gist';

alter table public.agendamentos
    add constraint agendamentos_intervalo_consistente check (
        (legado_sem_intervalo and duracao_minutos is null and inicio_em is null and fim_em is null)
        or (not legado_sem_intervalo and duracao_minutos is not null and duracao_minutos between 1 and 1440
            and inicio_em is not null and isfinite(inicio_em)
            and fim_em is not null and isfinite(fim_em)
            and fim_em - inicio_em = make_interval(mins => duracao_minutos))
    ),
    add constraint agendamentos_profissional_intervalo_excl exclude using gist (
        barbeiro_id with =, tstzrange(inicio_em, fim_em, '[)') with &&
    ) where (not legado_sem_intervalo);

create or replace function barberbook_private.validar_agendamento()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    fuso_loja text;
    agora timestamptz;
    dia_local date;
    nome_profissional text;
    preco_servico numeric(10, 2);
    duracao_servico smallint;
    validar_slot boolean;
    validar_servico boolean;
    intervalo tstzrange;
begin
    new.nome := btrim(new.nome);
    if new.whatsapp is null or char_length(new.whatsapp) > 64
       or btrim(new.whatsapp) !~ '^[+]?[0-9(). -]+$' then
        raise exception using errcode = '23514', message = 'WhatsApp inválido.';
    end if;
    new.whatsapp := case when btrim(new.whatsapp) like '+%' then '+' else '' end
        || regexp_replace(new.whatsapp, '[^0-9]', '', 'g');

    if tg_op = 'INSERT' then
        new.legado_sem_intervalo := false;
        validar_slot := true;
        validar_servico := true;
    else
        validar_servico := new.servico is distinct from old.servico;
        validar_slot := validar_servico or (new.barbeiro_id, new.data, new.horario)
            is distinct from (old.barbeiro_id, old.data, old.horario);
        new.legado_sem_intervalo := old.legado_sem_intervalo;
    end if;

    if validar_servico then
        select s.preco, s.duracao_minutos into preco_servico, duracao_servico
        from barberbook_private.servicos s where s.codigo = new.servico and s.ativo;
        if not found then
            raise exception using errcode = '23514', message = 'Serviço indisponível.';
        end if;
        new.preco := 'R$ ' || replace(preco_servico::text, '.', ',');
        new.duracao_minutos := duracao_servico;
    else
        new.preco := old.preco;
        new.duracao_minutos := old.duracao_minutos;
    end if;

    if not validar_slot then
        new.barbeiro_nome := old.barbeiro_nome;
        new.inicio_em := old.inicio_em;
        new.fim_em := old.fim_em;
        return new;
    end if;

    if new.duracao_minutos is null then
        raise exception using errcode = '23514',
            message = 'Para remarcar um registro sem duração histórica, selecione um novo serviço.';
    end if;
    select b.nome into nome_profissional
    from public.barbeiros b where b.id = new.barbeiro_id and b.ativo;
    if not found then
        raise exception using errcode = '23514', message = 'Profissional indisponível.';
    end if;
    if tg_op = 'INSERT' or new.barbeiro_id is distinct from old.barbeiro_id then
        new.barbeiro_nome := nome_profissional;
    else
        new.barbeiro_nome := old.barbeiro_nome;
    end if;

    select i.fuso into fuso_loja from barberbook_private.instalacao i;
    if not found then
        raise exception using errcode = '23514', message = 'Agenda ainda não configurada.';
    end if;
    if new.data is null or not isfinite(new.data) or new.horario is null
       or new.horario >= time '24:00' or extract(second from new.horario) <> 0 then
        raise exception using errcode = '23514', message = 'Data ou horário inválido.';
    end if;

    agora := clock_timestamp();
    dia_local := (agora at time zone fuso_loja)::date;
    intervalo := barberbook_private.intervalo_atendimento(new.data, new.horario, new.duracao_minutos, fuso_loja);
    if intervalo is null or lower(intervalo) <= agora
       or (tg_op = 'INSERT' and new.data > dia_local + 6)
       or not exists (
           select 1 from public.dias_disponiveis d
           where d.dia_semana = extract(dow from new.data) and d.ativo
       )
       or not exists (
           select 1 from public.horarios_disponiveis h
           where h.horario = new.horario and h.ativo
       )
       or exists (select 1 from public.datas_bloqueadas b where b.data = new.data)
       or not exists (
           select 1 from barberbook_private.janelas_expediente j
           where j.dia_semana = extract(dow from new.data)
             and lower(intervalo) >= barberbook_private.instante_civil(new.data, j.inicio, fuso_loja)
             and upper(intervalo) <= barberbook_private.instante_civil(new.data, j.fim, fuso_loja)
       ) then
        raise exception using errcode = '23514', message = 'Horário indisponível.';
    end if;

    new.inicio_em := lower(intervalo);
    new.fim_em := upper(intervalo);
    new.legado_sem_intervalo := false;
    return new;
end;
$$;

commit;
