begin;

do $$
declare
    papel text;
begin
    foreach papel in array array['barberbook_reservas_dono', 'barberbook_edge_exec'] loop
        if not exists (select 1 from pg_catalog.pg_roles where rolname = papel) then
            execute format('create role %I nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls', papel);
        end if;
        if exists (
            select 1 from pg_catalog.pg_roles r where r.rolname = papel and (
                (papel = 'barberbook_reservas_dono' and r.rolcanlogin)
                or r.rolinherit or r.rolsuper or r.rolcreatedb or r.rolcreaterole or r.rolreplication or r.rolbypassrls
                or exists (select 1 from pg_catalog.pg_auth_members m where m.member = r.oid)
                or pg_catalog.pg_has_role('anon', r.oid, 'MEMBER')
                or pg_catalog.pg_has_role('authenticated', r.oid, 'MEMBER')
                or pg_catalog.pg_has_role('service_role', r.oid, 'MEMBER')
                or (exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticator')
                    and pg_catalog.pg_has_role(to_regrole('authenticator'), r.oid, 'MEMBER'))
            )
        ) then
            raise exception 'Papel interno incompatível: %.', papel;
        end if;
    end loop;
end;
$$;

grant barberbook_reservas_dono to current_user;
create schema barberbook_reservas authorization barberbook_reservas_dono;
revoke all on schema barberbook_reservas from public, anon, authenticated, service_role, barberbook_edge_exec;
grant usage on schema public to barberbook_reservas_dono;
grant insert (nome, whatsapp, servico, data, horario, barbeiro_id)
    on public.agendamentos to barberbook_reservas_dono;
create policy criar_reserva_interna on public.agendamentos for insert to barberbook_reservas_dono
    with check (true);

set local role barberbook_reservas_dono;
set local search_path = '';

create table barberbook_reservas.configuracao (
    chave boolean primary key default true check (chave),
    tentativas_global integer not null default 120 check (tentativas_global between 1 and 100000),
    tentativas_origem integer not null default 30 check (tentativas_origem between 1 and 100000),
    janela_tentativas_segundos integer not null default 60 check (janela_tentativas_segundos between 1 and 86400),
    reservas_global integer not null default 60 check (reservas_global between 1 and 100000),
    reservas_contato integer not null default 3 check (reservas_contato between 1 and 100000),
    janela_reservas_segundos integer not null default 3600 check (janela_reservas_segundos between 1 and 86400),
    check (tentativas_origem <= tentativas_global and reservas_contato <= reservas_global)
);
insert into barberbook_reservas.configuracao default values;

create table barberbook_reservas.cotas (
    escopo text not null check (escopo in ('tentativas_global', 'tentativas_origem', 'reservas_global', 'reservas_contato')),
    resumo bytea not null check (octet_length(resumo) in (0, 32)),
    inicio_em timestamptz not null,
    expira_em timestamptz not null,
    usadas integer not null check (usadas > 0),
    primary key (escopo, resumo, inicio_em)
);
create index cotas_expiracao_idx on barberbook_reservas.cotas (expira_em);

create table barberbook_reservas.tokens (
    resumo bytea primary key check (octet_length(resumo) = 32),
    expira_em timestamptz not null
);
create index tokens_expiracao_idx on barberbook_reservas.tokens (expira_em);

create table barberbook_reservas.pedidos (
    resumo bytea primary key check (octet_length(resumo) = 32),
    prova bytea not null check (octet_length(prova) = 32),
    resultado text check (resultado in ('confirmada', 'conflito', 'invalida')),
    expira_em timestamptz not null
);
create index pedidos_expiracao_idx on barberbook_reservas.pedidos (expira_em);

alter table barberbook_reservas.configuracao enable row level security;
alter table barberbook_reservas.cotas enable row level security;
alter table barberbook_reservas.tokens enable row level security;
alter table barberbook_reservas.pedidos enable row level security;

create function barberbook_reservas.cobrar_cota(
    p_escopo text, p_resumo bytea, p_limite integer, p_segundos integer, p_agora timestamptz
) returns integer
language plpgsql
set search_path = ''
as $$
declare
    janela interval := make_interval(secs => p_segundos);
    inicio timestamptz := date_bin(janela, p_agora, timestamptz '2000-01-01 00:00:00+00');
    fim timestamptz := inicio + janela;
begin
    insert into barberbook_reservas.cotas as c (escopo, resumo, inicio_em, expira_em, usadas)
    values (p_escopo, p_resumo, inicio, fim, 1)
    on conflict (escopo, resumo, inicio_em) do update
    set usadas = c.usadas + 1, expira_em = greatest(c.expira_em, excluded.expira_em)
    where c.usadas < p_limite;
    -- Se a espera pelo lock atravessou a fronteira, o chamador desfaz o débito.
    if found and fim > clock_timestamp() then return 0; end if;
    return greatest(1, ceil(extract(epoch from fim - clock_timestamp()))::integer);
end;
$$;

create function barberbook_reservas.admitir_tentativa(p_origem bytea)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    cfg barberbook_reservas.configuracao;
    agora timestamptz := clock_timestamp();
    espera integer;
begin
    if p_origem is not null and octet_length(p_origem) <> 32 then
        raise exception using errcode = '22023', message = 'Resumo de origem inválido.';
    end if;
    select * into strict cfg from barberbook_reservas.configuracao where chave;
    -- A subtransação desfaz o débito global se a cota por origem rejeitar a tentativa.
    begin
        espera := barberbook_reservas.cobrar_cota('tentativas_global', '\x'::bytea,
            cfg.tentativas_global, cfg.janela_tentativas_segundos, agora);
        if espera > 0 then raise sqlstate 'BB001'; end if;
        if p_origem is not null then
            espera := barberbook_reservas.cobrar_cota('tentativas_origem', p_origem,
                cfg.tentativas_origem, cfg.janela_tentativas_segundos, agora);
            if espera > 0 then raise sqlstate 'BB001'; end if;
        end if;
    exception when sqlstate 'BB001' then
        return espera;
    end;
    return 0;
end;
$$;

create function barberbook_reservas.confirmar_reserva(
    p_chave bytea, p_prova bytea, p_token bytea, p_contato bytea,
    p_nome text, p_whatsapp text, p_servico text, p_data date, p_horario time, p_barbeiro_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    cfg barberbook_reservas.configuracao;
    agora timestamptz := clock_timestamp();
    prova bytea;
    registro barberbook_reservas.pedidos;
    resultado_final text;
    espera integer;
begin
    -- Só o servidor chama esta função depois da admissão e da verificação externa.
    if coalesce(octet_length(p_chave), 0) <> 32 or coalesce(octet_length(p_prova), 0) <> 32
       or coalesce(octet_length(p_token), 0) <> 32 or coalesce(octet_length(p_contato), 0) <> 32 then
        raise exception using errcode = '22023', message = 'Resumo criptográfico inválido.';
    end if;
    if p_nome is null or char_length(btrim(p_nome)) not between 1 and 120 or p_nome ~ '[[:cntrl:]]'
       or p_whatsapp is null or p_whatsapp !~ '^[+]?[0-9]{10,15}$'
       or p_servico is null or char_length(p_servico) not between 1 and 120
       or p_data is null or not isfinite(p_data) or p_horario is null or p_barbeiro_id is null then
        return jsonb_build_object('resultado', 'invalida');
    end if;
    select * into strict cfg from barberbook_reservas.configuracao where chave;
    insert into barberbook_reservas.tokens as t (resumo, expira_em)
    values (p_token, agora + interval '15 minutes')
    on conflict (resumo) do update set expira_em = excluded.expira_em
    where t.expira_em <= agora;
    if not found then return jsonb_build_object('resultado', 'token_reutilizado'); end if;

    -- A prova do servidor e o conteúdo vinculam a chave de idempotência ao mesmo pedido.
    prova := sha256(p_prova || convert_to(jsonb_build_array(
        btrim(p_nome), p_whatsapp, p_servico, p_data, p_horario, p_barbeiro_id)::text, 'UTF8'));
    insert into barberbook_reservas.pedidos as p (resumo, prova, resultado, expira_em)
    values (p_chave, prova, null, agora + interval '24 hours')
    on conflict (resumo) do update
    set prova = excluded.prova, resultado = null, expira_em = excluded.expira_em
    where p.expira_em <= agora;
    select * into strict registro from barberbook_reservas.pedidos where resumo = p_chave for update;
    if registro.prova <> prova then return jsonb_build_object('resultado', 'chave_incompativel'); end if;
    if registro.resultado is not null then return jsonb_build_object('resultado', registro.resultado); end if;

    -- As cotas de gravação só são debitadas se a reserva for gravada.
    -- A exceção esperada desfaz o débito e preserva o uso do token no bloco externo.
    begin
        espera := barberbook_reservas.cobrar_cota('reservas_global', '\x'::bytea,
            cfg.reservas_global, cfg.janela_reservas_segundos, agora);
        if espera > 0 then raise sqlstate 'BB001'; end if;
        espera := barberbook_reservas.cobrar_cota('reservas_contato', p_contato,
            cfg.reservas_contato, cfg.janela_reservas_segundos, agora);
        if espera > 0 then raise sqlstate 'BB001'; end if;

        insert into public.agendamentos (nome, whatsapp, servico, data, horario, barbeiro_id)
        values (p_nome, p_whatsapp, p_servico, p_data, p_horario, p_barbeiro_id);
        resultado_final := 'confirmada';
    exception
        when sqlstate 'BB001' then return jsonb_build_object('resultado', 'limitada', 'tentar_em', espera);
        when unique_violation or exclusion_violation then resultado_final := 'conflito';
        when check_violation or foreign_key_violation then resultado_final := 'invalida';
    end;
    update barberbook_reservas.pedidos set resultado = resultado_final where resumo = p_chave;
    return jsonb_build_object('resultado', resultado_final);
end;
$$;

create function barberbook_reservas.limpar_expirados(p_lote integer default 1000)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    agora timestamptz := clock_timestamp();
    removidas integer;
    total integer := 0;
begin
    if p_lote is null or p_lote not between 1 and 10000 then
        raise exception using errcode = '22023', message = 'Tamanho de lote inválido.';
    end if;
    -- As tabelas são limpas na mesma ordem da gravação, sem esperar por registros em uso.
    delete from barberbook_reservas.tokens where resumo in (
        select resumo from barberbook_reservas.tokens where expira_em <= agora
        order by expira_em limit p_lote for update skip locked
    );
    get diagnostics removidas = row_count;
    total := total + removidas;
    delete from barberbook_reservas.pedidos where resumo in (
        select resumo from barberbook_reservas.pedidos where expira_em <= agora
        order by expira_em limit p_lote for update skip locked
    );
    get diagnostics removidas = row_count;
    total := total + removidas;
    delete from barberbook_reservas.cotas where (escopo, resumo, inicio_em) in (
        select escopo, resumo, inicio_em from barberbook_reservas.cotas where expira_em <= agora
        order by expira_em limit p_lote for update skip locked
    );
    get diagnostics removidas = row_count;
    return total + removidas;
end;
$$;

revoke all on all tables in schema barberbook_reservas from public, anon, authenticated, service_role, barberbook_edge_exec;
revoke all on all functions in schema barberbook_reservas from public, anon, authenticated, service_role, barberbook_edge_exec;
grant usage on schema barberbook_reservas to barberbook_edge_exec;
grant execute on function barberbook_reservas.admitir_tentativa(bytea),
    barberbook_reservas.confirmar_reserva(bytea, bytea, bytea, bytea, text, text, text, date, time, uuid)
    to barberbook_edge_exec;

reset role;
commit;
