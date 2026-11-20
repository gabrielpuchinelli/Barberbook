\set ON_ERROR_STOP on
begin;
\ir fixtures.sql

create function pg_temp.exigir(condicao boolean, rotulo text)
returns void language plpgsql as $$
begin
    if condicao is distinct from true then raise exception 'Falhou: %', rotulo; end if;
end;
$$;

create function pg_temp.negar(comando text)
returns void language plpgsql as $$
begin
    execute comando;
    raise exception 'Operação deveria ser negada.';
exception when insufficient_privilege then
    null;
end;
$$;

create function pg_temp.dia() returns date language sql stable as $$
    select (statement_timestamp() at time zone 'America/Sao_Paulo')::date + 1
$$;

create function pg_temp.inserir_direto()
returns void language sql as $$
    insert into public.agendamentos (nome, whatsapp, servico, data, horario, barbeiro_id)
    values ('Pessoa fictícia', '21900000000', 'Corte teste', pg_temp.dia(), '09:00',
            '10000000-0000-4000-8000-000000000001')
    on conflict do nothing
$$;

grant execute on function pg_temp.exigir(boolean, text), pg_temp.negar(text),
    pg_temp.dia(), pg_temp.inserir_direto() to anon, authenticated, barberbook_edge_exec;

select pg_temp.exigir(not exists (
    select 1 from pg_catalog.pg_class c
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) privil
    where c.oid = 'public.agendamentos'::regclass and grantee = 0 and privilege_type = 'INSERT'
) and not exists (
    select 1 from pg_catalog.pg_attribute a
    cross join lateral aclexplode(a.attacl) privil
    where a.attrelid = 'public.agendamentos'::regclass and grantee = 0 and privilege_type = 'INSERT'
), 'PUBLIC sem INSERT na tabela ou nas colunas');
select pg_temp.exigir((
    select count(*) = 1 and bool_and(polroles = array['barberbook_reservas_dono'::regrole::oid])
    from pg_catalog.pg_policy where polrelid = 'public.agendamentos'::regclass
      and polcmd in ('a', '*') and polpermissive
), 'somente a política interna de inserção permanece');

set local role anon;
select pg_temp.negar('select pg_temp.inserir_direto()');
select pg_temp.negar('insert into public.agendamentos_publicos default values');
select pg_temp.negar('select barberbook_reservas.admitir_tentativa(null)');
select pg_temp.negar('select nome, whatsapp from public.agendamentos');
select pg_temp.exigir(
    public.horarios_elegiveis('Corte teste', '10000000-0000-4000-8000-000000000001', pg_temp.dia())
      = '{"total":3,"horarios":["09:00","09:30","10:00"]}'::jsonb, 'consulta pública completa sem dados pessoais');
reset role;

set local role barberbook_edge_exec;
select pg_temp.negar('select nome, whatsapp from public.agendamentos');
select pg_temp.negar('select pg_temp.inserir_direto()');
select pg_temp.exigir(
    barberbook_reservas.confirmar_reserva(sha256('pedido'::bytea), sha256('prova'::bytea),
        sha256('token'::bytea), sha256('contato'::bytea), 'Pessoa fictícia', '21900000000',
        'Corte teste', pg_temp.dia(), '09:00', '10000000-0000-4000-8000-000000000001')
      = '{"resultado":"confirmada"}'::jsonb, 'operação privada confirmada');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000004', true);
select pg_temp.negar('select pg_temp.inserir_direto()');
select pg_temp.negar('select barberbook_reservas.admitir_tentativa(null)');
select pg_temp.exigir((select count(*) = 0 from public.agendamentos), 'sem perfil não lê reservas');
select pg_temp.exigir(
    public.horarios_elegiveis('Corte teste', '10000000-0000-4000-8000-000000000001', pg_temp.dia())
      = '{"total":2,"horarios":["09:30","10:00"]}'::jsonb, 'consulta retira o horário ocupado');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
select pg_temp.negar('select pg_temp.inserir_direto()');
with editados as (update public.agendamentos set nome = 'Outro nome fictício' returning id)
select pg_temp.exigir(count(*) = 0, 'barbeiro não edita reserva de outro profissional') from editados;

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select pg_temp.negar('select pg_temp.inserir_direto()');
with editados as (update public.agendamentos set nome = 'Contato fictício atualizado' returning id)
select pg_temp.exigir(count(*) = 1, 'barbeiro pode editar a própria reserva') from editados;
select pg_temp.negar('insert into public.datas_bloqueadas values (pg_temp.dia())');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select pg_temp.negar('select pg_temp.inserir_direto()');
insert into public.datas_bloqueadas values (pg_temp.dia() + 1);
with removidos as (delete from public.agendamentos returning id)
select pg_temp.exigir(count(*) = 1, 'administrador pode excluir reserva') from removidos;
reset role;
rollback;
