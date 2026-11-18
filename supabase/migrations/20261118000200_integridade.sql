begin;

-- Papéis internos da instalação. Só o executor confiável da migração pode assumi-los.
do $$
declare
    papel text;
begin
    foreach papel in array array['barberbook_validacao', 'barberbook_ocupacao'] loop
        if not exists (select 1 from pg_catalog.pg_roles where rolname = papel) then
            execute format(
                'create role %I nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls',
                papel
            );
        end if;
        if exists (
            select 1 from pg_catalog.pg_roles r
            where r.rolname = papel and (
                r.rolcanlogin or r.rolinherit or r.rolsuper or r.rolcreatedb or r.rolcreaterole
                or r.rolreplication or r.rolbypassrls
                or exists (select 1 from pg_catalog.pg_auth_members m where m.member = r.oid)
                or pg_catalog.pg_has_role('anon', r.oid, 'MEMBER')
                or pg_catalog.pg_has_role('authenticated', r.oid, 'MEMBER')
                or pg_catalog.pg_has_role('service_role', r.oid, 'MEMBER')
            )
        ) then
            raise exception 'Papel interno incompatível: %.', papel;
        end if;
    end loop;
end;
$$;

grant barberbook_validacao, barberbook_ocupacao to current_user;
grant usage on schema public, barberbook_private to barberbook_validacao, barberbook_ocupacao;
grant create on schema barberbook_private to barberbook_validacao;

grant select (fuso) on barberbook_private.instalacao to barberbook_validacao, barberbook_ocupacao;
grant select (codigo, preco, ativo) on barberbook_private.servicos to barberbook_validacao;
grant select (id, nome, ativo) on public.barbeiros to barberbook_validacao;
grant select on public.dias_disponiveis, public.horarios_disponiveis,
    public.datas_bloqueadas to barberbook_validacao;

create policy validar_instalacao on barberbook_private.instalacao
    for select to barberbook_validacao, barberbook_ocupacao using (true);
create policy validar_servico on barberbook_private.servicos
    for select to barberbook_validacao using (true);
create policy validar_barbeiro on public.barbeiros
    for select to barberbook_validacao using (true);
create policy validar_dia on public.dias_disponiveis
    for select to barberbook_validacao using (true);
create policy validar_horario on public.horarios_disponiveis
    for select to barberbook_validacao using (true);
create policy validar_bloqueio on public.datas_bloqueadas
    for select to barberbook_validacao using (true);

-- Mesmo lock transacional antes de qualquer bloqueio de linha da agenda.
-- Com READ COMMITTED, as consultas voláteis do validador veem o estado após a espera.
create function barberbook_private.serializar_agenda()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using errcode = '0A000', message = 'Escritas da agenda requerem READ COMMITTED.';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(1841761024, 1);
    return null;
end;
$$;

create function barberbook_private.validar_agendamento()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    fuso_loja text;
    agora timestamptz;
    momento_local timestamp;
    momento timestamptz;
    dia_local date;
    nome_profissional text;
    preco_servico numeric(10, 2);
    validar_slot boolean;
    validar_servico boolean;
begin
    new.nome := btrim(new.nome);
    if new.whatsapp is null or char_length(new.whatsapp) > 64
       or btrim(new.whatsapp) !~ '^[+]?[0-9(). -]+$' then
        raise exception using errcode = '23514', message = 'WhatsApp inválido.';
    end if;
    new.whatsapp := case when btrim(new.whatsapp) like '+%' then '+' else '' end
        || regexp_replace(new.whatsapp, '[^0-9]', '', 'g');

    if tg_op = 'INSERT' then
        validar_slot := true;
        validar_servico := true;
    else
        validar_slot := (new.barbeiro_id, new.data, new.horario)
            is distinct from (old.barbeiro_id, old.data, old.horario);
        validar_servico := new.servico is distinct from old.servico;
    end if;

    if validar_servico then
        select s.preco into preco_servico
        from barberbook_private.servicos s where s.codigo = new.servico and s.ativo;
        if not found then
            raise exception using errcode = '23514', message = 'Serviço indisponível.';
        end if;
        new.preco := 'R$ ' || replace(preco_servico::text, '.', ',');
    else
        new.preco := old.preco;
    end if;

    if validar_slot then
        select b.nome into nome_profissional
        from public.barbeiros b where b.id = new.barbeiro_id and b.ativo;
        if not found then
            raise exception using errcode = '23514', message = 'Profissional indisponível.';
        end if;
        if tg_op = 'INSERT' then
            new.barbeiro_nome := nome_profissional;
        elsif new.barbeiro_id is distinct from old.barbeiro_id then
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
        momento_local := new.data + new.horario;
        momento := momento_local at time zone fuso_loja;
        if momento <= agora or (momento at time zone fuso_loja) <> momento_local
           or (tg_op = 'INSERT' and new.data > dia_local + 6)
           or not exists (
               select 1 from public.dias_disponiveis d
               where d.dia_semana = extract(dow from new.data) and d.ativo
           )
           or not exists (
               select 1 from public.horarios_disponiveis h where h.horario = new.horario and h.ativo
           )
           or exists (select 1 from public.datas_bloqueadas b where b.data = new.data) then
            raise exception using errcode = '23514', message = 'Horário indisponível.';
        end if;
    else
        new.barbeiro_nome := old.barbeiro_nome;
    end if;

    return new;
end;
$$;

revoke all on function barberbook_private.serializar_agenda(), barberbook_private.validar_agendamento()
    from public, anon, authenticated, service_role;

create trigger serializar_agenda before insert or update or delete on public.agendamentos
for each statement execute function barberbook_private.serializar_agenda();
create trigger validar_agendamento before insert or update on public.agendamentos
for each row execute function barberbook_private.validar_agendamento();

create trigger serializar_agenda before insert or update or delete or truncate on public.barbeiros
for each statement execute function barberbook_private.serializar_agenda();
create trigger serializar_agenda before insert or update or delete or truncate on public.dias_disponiveis
for each statement execute function barberbook_private.serializar_agenda();
create trigger serializar_agenda before insert or update or delete or truncate on public.horarios_disponiveis
for each statement execute function barberbook_private.serializar_agenda();
create trigger serializar_agenda before insert or update or delete or truncate on public.datas_bloqueadas
for each statement execute function barberbook_private.serializar_agenda();
create trigger serializar_agenda before insert or update or delete or truncate on barberbook_private.instalacao
for each statement execute function barberbook_private.serializar_agenda();
create trigger serializar_agenda before insert or update or delete or truncate on barberbook_private.servicos
for each statement execute function barberbook_private.serializar_agenda();

alter function barberbook_private.validar_agendamento() owner to barberbook_validacao;
revoke create on schema barberbook_private from barberbook_validacao;

commit;
