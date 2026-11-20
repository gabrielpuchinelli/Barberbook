begin;

-- O corte é atômico. Uma agenda ocupada demais deve abortar em vez de esperar indefinidamente.
set local lock_timeout = '5s';
lock table public.agendamentos in access exclusive mode;

revoke insert on table public.agendamentos from public, anon, authenticated;

do $$
declare
    colunas text;
begin
    -- Revogar INSERT na tabela não revoga os grants por coluna.
    select string_agg(format('%I', attname), ', ' order by attnum) into strict colunas
    from pg_catalog.pg_attribute
    where attrelid = 'public.agendamentos'::regclass and attnum > 0 and not attisdropped;
    execute format('revoke insert (%s) on table public.agendamentos from public, anon, authenticated', colunas);
end;
$$;

drop policy criar_reserva_publica on public.agendamentos;

do $$
declare
    papel oid;
    dono oid := 'barberbook_reservas_dono'::regrole;
    execucao oid := 'barberbook_edge_exec'::regrole;
begin
    -- Detecta grants efetivos herdados, inclusive via PUBLIC, e permissões na view.
    for papel in
        select oid from pg_catalog.pg_roles where rolname in ('anon', 'authenticated', 'authenticator')
    loop
        if has_any_column_privilege(papel, 'public.agendamentos', 'INSERT')
           or has_any_column_privilege(papel, 'public.agendamentos_publicos', 'INSERT')
           or pg_has_role(papel, dono, 'MEMBER')
           or pg_has_role(papel, execucao, 'MEMBER')
           or has_function_privilege(papel, 'barberbook_reservas.admitir_tentativa(bytea)', 'EXECUTE')
           or has_function_privilege(papel,
               'barberbook_reservas.confirmar_reserva(bytea,bytea,bytea,bytea,text,text,text,date,time,uuid)', 'EXECUTE') then
            raise exception 'Corte cancelado: o papel % ainda possui um caminho de criação.', papel::regrole;
        end if;
    end loop;

    if not exists (
        select from pg_catalog.pg_policy
        where polrelid = 'public.agendamentos'::regclass and polcmd = 'a'
          and polpermissive and polroles = array[dono]
    ) or exists (
        select from pg_catalog.pg_policy
        where polrelid = 'public.agendamentos'::regclass and polcmd in ('a', '*')
          and polpermissive and polroles <> array[dono]
    ) or not has_column_privilege(dono, 'public.agendamentos', 'nome', 'INSERT')
      or has_any_column_privilege(execucao, 'public.agendamentos', 'INSERT') then
        raise exception 'Corte cancelado: a política de criação interna ou seus privilégios divergem do esperado.';
    end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
