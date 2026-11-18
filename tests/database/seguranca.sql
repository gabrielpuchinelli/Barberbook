\set ON_ERROR_STOP on
begin;
\ir fixtures.sql

create schema barberbook_test;
grant usage on schema barberbook_test to anon, authenticated;

create function barberbook_test.verificar(condicao boolean, cenario text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
    if condicao is distinct from true then
        raise exception 'Falhou: %', cenario;
    end if;
end;
$$;

create function barberbook_test.erro_esperado(comando text, codigo text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
    begin
        execute comando;
    exception when others then
        if sqlstate = codigo then return; end if;
        raise exception 'Esperado SQLSTATE %, recebido % (%).', codigo, sqlstate, sqlerrm;
    end;
    raise exception 'Esperado SQLSTATE %, mas a operação teve sucesso.', codigo;
end;
$$;

create function barberbook_test.dia(deslocamento integer)
returns date language sql stable security invoker set search_path = '' as $$
    select (statement_timestamp() at time zone 'America/Sao_Paulo')::date + deslocamento
$$;

create function barberbook_test.reservar(
    dias integer, hora text, profissional uuid, servico text default 'Corte teste',
    telefone text default '(21) 90000-0000'
)
returns void language sql security invoker set search_path = '' as $$
    insert into public.agendamentos (nome, whatsapp, servico, preco, data, horario, barbeiro_id, barbeiro_nome)
    values ('Pessoa fictícia', telefone, servico, 'R$ 0,01', barberbook_test.dia(dias),
            hora::time, profissional, 'Nome enviado pelo navegador')
$$;

grant execute on all functions in schema barberbook_test to anon, authenticated;

select barberbook_test.erro_esperado(
    'update barberbook_private.instalacao set fuso = ''Fuso/Inexistente''', '22023');
select barberbook_test.verificar(
    (select array_agg(column_name::text order by ordinal_position)
     from information_schema.columns where table_schema = 'public' and table_name = 'agendamentos_publicos')
    = array['data', 'horario', 'barbeiro_id'], 'colunas exatas da view');
select barberbook_test.verificar(
    (select r.rolname = 'barberbook_ocupacao' and not r.rolbypassrls and not r.rolcanlogin
     from pg_class c join pg_roles r on r.oid = c.relowner
     where c.oid = 'public.agendamentos_publicos'::regclass), 'proprietário restrito da view');
select barberbook_test.verificar(
    not has_column_privilege('barberbook_ocupacao', 'public.agendamentos', 'nome', 'SELECT')
    and not has_column_privilege('barberbook_ocupacao', 'public.agendamentos', 'whatsapp', 'SELECT')
    and not has_column_privilege('barberbook_validacao', 'public.agendamentos', 'nome', 'SELECT')
    and not has_function_privilege('anon', 'public.eh_admin()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'barberbook_private.validar_agendamento()', 'EXECUTE'),
    'projeção e execução por menor privilégio');
select barberbook_test.verificar(
    not has_sequence_privilege('anon', 'public.agendamentos_id_seq', 'USAGE')
    and not has_table_privilege('anon', 'public.agendamentos', 'TRUNCATE'),
    'nenhum grant automático na sequência ou ações não utilizadas');

set local time zone 'Asia/Tokyo';
set local role anon;
select barberbook_test.verificar((select count(*) from public.barbeiros where ativo) = 2, 'só profissionais ativos');
select barberbook_test.verificar((select count(*) from public.dias_disponiveis) = 7, 'dias públicos');
select barberbook_test.verificar((select count(*) from public.horarios_disponiveis) = 4, 'horários públicos');
select barberbook_test.verificar((select count(*) from public.datas_bloqueadas) = 1, 'bloqueios públicos');
select barberbook_test.erro_esperado('select nome, whatsapp from public.agendamentos', '42501');
select barberbook_test.erro_esperado(
    $$insert into public.agendamentos (nome, whatsapp, servico, data, horario, barbeiro_id)
      values ('Pessoa fictícia', '21900000000', 'Corte teste', barberbook_test.dia(2), '10:00',
              '10000000-0000-4000-8000-000000000001') returning nome, whatsapp$$, '42501');
select barberbook_test.erro_esperado('update public.agendamentos set nome = ''invalido''', '42501');
select barberbook_test.erro_esperado('delete from public.agendamentos', '42501');
select barberbook_test.erro_esperado('select nome from public.agendamentos_publicos', '42703');
select barberbook_test.erro_esperado('delete from public.agendamentos_publicos', '42501');
select barberbook_test.erro_esperado('select public.eh_admin()', '42501');
select barberbook_test.erro_esperado('select public.eh_barbeiro()', '42501');
select barberbook_test.erro_esperado('select public.barbeiro_atual_id()', '42501');
select barberbook_test.erro_esperado('select * from barberbook_private.perfis', '42501');
select barberbook_test.erro_esperado('update public.dias_disponiveis set ativo = false', '42501');
select barberbook_test.erro_esperado('delete from public.horarios_disponiveis', '42501');
select barberbook_test.erro_esperado('insert into public.datas_bloqueadas values (barberbook_test.dia(5))', '42501');

select barberbook_test.reservar(1, '09:00', '10000000-0000-4000-8000-000000000001');
select barberbook_test.reservar(1, '09:00', '10000000-0000-4000-8000-000000000002');
select barberbook_test.erro_esperado(
    $$select barberbook_test.reservar(1, '09:00', '10000000-0000-4000-8000-000000000001')$$, '23505');
select barberbook_test.erro_esperado(
    $$select barberbook_test.reservar(2, '09:00', '10000000-0000-4000-8000-000000000001', 'Serviço inativo')$$, '23514');
select barberbook_test.erro_esperado(
    $$select barberbook_test.reservar(2, '09:00', '10000000-0000-4000-8000-000000000001', 'Curso inexistente')$$, '23514');
select barberbook_test.erro_esperado(
    $$select barberbook_test.reservar(2, '09:00', '10000000-0000-4000-8000-000000000003')$$, '23514');
select barberbook_test.erro_esperado(
    $$select barberbook_test.reservar(2, '09:00', '10000000-0000-4000-8000-000000000001', 'Corte teste', 'abc123')$$, '23514');
select barberbook_test.erro_esperado(
    $$select barberbook_test.reservar(2, '11:00', '10000000-0000-4000-8000-000000000001')$$, '23514');
select barberbook_test.erro_esperado(
    $$select barberbook_test.reservar(2, '09:00:30', '10000000-0000-4000-8000-000000000001')$$, '23514');
select barberbook_test.erro_esperado(
    $$select barberbook_test.reservar(3, '09:00', '10000000-0000-4000-8000-000000000001')$$, '23514');
select barberbook_test.erro_esperado(
    $$select barberbook_test.reservar(4, '09:00', '10000000-0000-4000-8000-000000000001')$$, '23514');
select barberbook_test.erro_esperado(
    $$select barberbook_test.reservar(-1, '09:00', '10000000-0000-4000-8000-000000000001')$$, '23514');
select barberbook_test.erro_esperado(
    $$select barberbook_test.reservar(8, '09:00', '10000000-0000-4000-8000-000000000001')$$, '23514');
select barberbook_test.verificar((select count(*) from public.agendamentos_publicos) = 2, 'ocupação pública sem PII');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000004', true);
select barberbook_test.verificar(not public.eh_admin() and not public.eh_barbeiro()
    and public.barbeiro_atual_id() is null, 'autenticado sem perfil');
select barberbook_test.verificar((select count(*) from public.agendamentos) = 0, 'sem perfil não vê reservas');
select barberbook_test.verificar((select count(*) from public.agendamentos_publicos) = 2, 'sem perfil vê ocupação');
select barberbook_test.reservar(2, '09:00', '10000000-0000-4000-8000-000000000001');
select barberbook_test.verificar((select count(*) from public.agendamentos) = 0, 'criador sem perfil não lê a reserva');
select barberbook_test.erro_esperado('select * from barberbook_private.perfis', '42501');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select barberbook_test.verificar(public.eh_barbeiro() and not public.eh_admin()
    and public.barbeiro_atual_id() = '10000000-0000-4000-8000-000000000001', 'RPCs do profissional A');
select barberbook_test.verificar(
    (select count(*) from public.agendamentos) = 2
    and (select bool_and(preco = 'R$ 25,00' and barbeiro_nome = 'Profissional A'
                        and whatsapp = '21900000000') from public.agendamentos),
    'isolamento, preço, profissional e WhatsApp canônicos');
with alterados as (
    update public.agendamentos set nome = 'Fora do escopo'
    where barbeiro_id = '10000000-0000-4000-8000-000000000002' returning id
)
select barberbook_test.verificar(count(*) = 0, 'barbeiro não edita outro') from alterados;
with removidos as (
    delete from public.agendamentos
    where barbeiro_id = '10000000-0000-4000-8000-000000000002' returning id
)
select barberbook_test.verificar(count(*) = 0, 'barbeiro não exclui outro') from removidos;
select barberbook_test.erro_esperado(
    $$update public.agendamentos set barbeiro_id = '10000000-0000-4000-8000-000000000002'$$, '42501');
select barberbook_test.erro_esperado($$update public.agendamentos set preco = 'R$ 0,00'$$, '42501');
select barberbook_test.erro_esperado(
    'insert into public.horarios_disponiveis values (''12:00'', true)', '42501');
select barberbook_test.erro_esperado(
    'insert into public.datas_bloqueadas values (barberbook_test.dia(5))', '42501');
select barberbook_test.erro_esperado(
    'insert into public.dias_disponiveis values (0, true) on conflict (dia_semana) do update set ativo = excluded.ativo',
    '42501');
with alterados as (
    update public.agendamentos set nome = 'Nome corrigido', servico = 'Barba teste'
    where data = barberbook_test.dia(1) returning *
)
select barberbook_test.verificar(count(*) = 1 and bool_and(preco = 'R$ 17,50'), 'edição e retorno com preço canônico')
from alterados;
select barberbook_test.erro_esperado(
    'update public.agendamentos set data = barberbook_test.dia(3) where data = barberbook_test.dia(1)', '23514');
select barberbook_test.erro_esperado(
    'update public.agendamentos set data = barberbook_test.dia(2) where data = barberbook_test.dia(1)', '23505');
with removidos as (delete from public.agendamentos where data = barberbook_test.dia(2) returning id)
select barberbook_test.verificar(count(*) = 1, 'barbeiro pode excluir reserva própria') from removidos;

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
select barberbook_test.verificar(public.barbeiro_atual_id() = '10000000-0000-4000-8000-000000000002'
    and (select count(*) from public.agendamentos) = 1, 'escopo do profissional B');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000005', true);
select barberbook_test.verificar(not public.eh_barbeiro() and (select count(*) from public.agendamentos) = 0,
    'profissional inativo sem acesso privado');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select barberbook_test.verificar(public.eh_admin() and not public.eh_barbeiro()
    and public.barbeiro_atual_id() is null and (select count(*) from public.agendamentos) = 2, 'escopo do administrador');
update public.agendamentos set data = barberbook_test.dia(8)
where barbeiro_id = '10000000-0000-4000-8000-000000000002';
select barberbook_test.verificar((select count(*) from public.agendamentos_publicos) = 1,
    'remarcação fora da janela não aparece na view');
insert into public.dias_disponiveis values (0, true)
on conflict (dia_semana) do update set dia_semana = excluded.dia_semana, ativo = excluded.ativo;
insert into public.horarios_disponiveis values ('09:30', false)
on conflict (horario) do update set horario = excluded.horario, ativo = excluded.ativo;
select barberbook_test.verificar(
    (select not ativo from public.horarios_disponiveis where horario = time '09:30'), 'upsert de horário');
delete from public.horarios_disponiveis where horario = time '09:00';
insert into public.datas_bloqueadas values (barberbook_test.dia(5));
delete from public.datas_bloqueadas where data = barberbook_test.dia(5);
select barberbook_test.verificar(
    (select count(*) from public.agendamentos_publicos) = 1
    and not exists (select 1 from public.datas_bloqueadas where data = barberbook_test.dia(5)),
    'remoção de horário preserva reserva existente e desbloqueio funciona');
update public.agendamentos set nome = 'Contato atualizado' where data = barberbook_test.dia(1);
with removidos as (
    delete from public.agendamentos
    where barbeiro_id = '10000000-0000-4000-8000-000000000002' returning id
)
select barberbook_test.verificar(count(*) = 1, 'administrador pode excluir reserva de outro profissional') from removidos;
select barberbook_test.erro_esperado('insert into public.barbeiros (nome) values (''Nao permitido'')', '42501');
select barberbook_test.erro_esperado('update barberbook_private.perfis set ativo = false', '42501');

reset role;
update barberbook_private.perfis set ativo = false where user_id = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
select barberbook_test.verificar(not public.eh_admin() and (select count(*) from public.agendamentos) = 0,
    'revogação efetiva sem renovar JWT');
rollback;
\echo Matriz de permissões e integridade passou.
