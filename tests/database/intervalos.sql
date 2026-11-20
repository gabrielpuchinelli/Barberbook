\set ON_ERROR_STOP on
begin;
\ir fixtures.sql
set local time zone 'Asia/Tokyo';

create function pg_temp.dia() returns date language sql stable as $$
    select (statement_timestamp() at time zone 'America/Sao_Paulo')::date + 1
$$;

create function pg_temp.reservar(hora time, servico text, profissional uuid, dia date default pg_temp.dia())
returns void language sql as $$
    insert into public.agendamentos (nome, whatsapp, servico, data, horario, barbeiro_id)
    values ('Pessoa fictícia', '21900000000', servico, dia, hora, profissional)
$$;

create function pg_temp.exigir(condicao boolean, rotulo text)
returns void language plpgsql as $$
begin
    if condicao is distinct from true then raise exception 'Falhou: %', rotulo; end if;
end;
$$;

create function pg_temp.erro_esperado(comando text, codigo text)
returns void language plpgsql as $$
begin
    execute comando;
    raise exception 'Operação aceita, esperado %', codigo;
exception when others then
    if sqlstate <> codigo then raise; end if;
end;
$$;

grant execute on function pg_temp.dia(), pg_temp.reservar(time, text, uuid, date),
    pg_temp.exigir(boolean, text), pg_temp.erro_esperado(text, text) to anon, authenticated;

insert into public.horarios_disponiveis (horario)
values ('10:30'), ('11:30'), ('15:30'), ('23:30'), ('23:45'), ('02:30');
select pg_temp.erro_esperado(
    $$insert into barberbook_private.janelas_expediente values
      (extract(dow from pg_temp.dia()), '10:30', '13:30')$$, '23P01');
select pg_temp.erro_esperado(
    $$update barberbook_private.servicos set duracao_minutos = 0$$, '23514');
select pg_temp.exigir(
    barberbook_private.instante_civil('2026-03-08', '02:30', 'America/New_York') is null
    and barberbook_private.instante_civil('2026-11-01', '01:30', 'America/New_York') is null
    and barberbook_private.instante_civil('2026-11-01', '02:30', 'America/New_York')
        = timestamptz '2026-11-01 07:30:00+00'
    and barberbook_private.instante_civil('2026-04-05', '01:45', 'Australia/Lord_Howe') is null
    and barberbook_private.instante_civil('2026-04-05', '02:00', 'Australia/Lord_Howe')
        = timestamptz '2026-04-04 15:30:00+00',
    'horários inexistentes e repetidos, incluindo mudança de meia hora');

savepoint transicoes_civis;
update barberbook_private.instalacao set fuso = 'America/New_York';
update public.dias_disponiveis set ativo = true;
delete from public.datas_bloqueadas;
delete from barberbook_private.janelas_expediente;
insert into barberbook_private.janelas_expediente values (0, '00:00', '05:00');
delete from public.horarios_disponiveis;
insert into public.horarios_disponiveis (horario)
values ('01:00'), ('01:30'), ('02:30'), ('03:00'), ('03:30');

-- Injeta apenas o relógio no teste para manter as transições na janela pública de sete dias.
-- As definições de produção e os dados são restaurados pelo savepoint.
do $$
declare
    relogio text := 'current_setting(''barberbook_test.instante'')::timestamptz';
begin
    execute replace(pg_get_functiondef('public.horarios_elegiveis(text,uuid,date)'::regprocedure),
                    'statement_timestamp()', relogio);
    execute replace(pg_get_functiondef('barberbook_private.validar_agendamento()'::regprocedure),
                    'clock_timestamp()', relogio);
end;
$$;

set local role anon;
set local barberbook_test.instante = '2026-03-07 18:00+00';
select pg_temp.exigir(
    public.horarios_elegiveis('Corte teste', '10000000-0000-4000-8000-000000000001', '2026-03-08')
      = '{"total":4,"horarios":["01:00","01:30","03:00","03:30"]}'::jsonb,
    'RPC omite hora inexistente');
select pg_temp.erro_esperado(
    $$select pg_temp.reservar('02:30', 'Corte teste', '10000000-0000-4000-8000-000000000001', '2026-03-08')$$,
    '23514');

set local barberbook_test.instante = '2026-10-31 18:00+00';
select pg_temp.exigir(
    public.horarios_elegiveis('Corte teste', '10000000-0000-4000-8000-000000000001', '2026-11-01')
      = '{"total":3,"horarios":["02:30","03:00","03:30"]}'::jsonb,
    'RPC omite horas repetidas e retorna inícios normais');
select pg_temp.erro_esperado(
    $$select pg_temp.reservar('01:30', 'Corte teste', '10000000-0000-4000-8000-000000000001', '2026-11-01')$$,
    '23514');

reset role;
update barberbook_private.janelas_expediente set inicio = '01:00';
set local role anon;
select pg_temp.exigir(
    public.horarios_elegiveis('Corte teste', '10000000-0000-4000-8000-000000000001', '2026-11-01')
      = '{"total":0,"horarios":[]}'::jsonb, 'limite ambíguo invalida janela');
select pg_temp.erro_esperado(
    $$select pg_temp.reservar('02:30', 'Corte teste', '10000000-0000-4000-8000-000000000001', '2026-11-01')$$,
    '23514');
reset role;
update barberbook_private.janelas_expediente set inicio = '00:00';
set local role anon;
select pg_temp.reservar('02:30', 'Corte teste', '10000000-0000-4000-8000-000000000001', '2026-11-01');
select pg_temp.reservar('03:00', 'Corte teste', '10000000-0000-4000-8000-000000000001', '2026-11-01');
reset role;
select pg_temp.exigir(
    (select count(*) = 2 and min(fim_em) = max(inicio_em) from public.agendamentos),
    'atendimentos normais consecutivos após o atraso do relógio');
rollback to savepoint transicoes_civis;

set local role anon;
select pg_temp.reservar('09:00', 'Barba teste', '10000000-0000-4000-8000-000000000001');
select pg_temp.erro_esperado(
    $$select pg_temp.reservar('09:30', 'Corte teste', '10000000-0000-4000-8000-000000000001')$$, '23P01');
select pg_temp.reservar('10:00', 'Corte teste', '10000000-0000-4000-8000-000000000001');
select pg_temp.reservar('09:30', 'Corte teste', '10000000-0000-4000-8000-000000000002');
select pg_temp.reservar('15:30', 'Corte teste', '10000000-0000-4000-8000-000000000002');
select pg_temp.reservar('23:30', 'Corte teste', '10000000-0000-4000-8000-000000000002');
select pg_temp.exigir(
    public.horarios_elegiveis('Corte teste', '10000000-0000-4000-8000-000000000001', pg_temp.dia())
      = '{"total":3,"horarios":["10:30","15:30","23:30"]}'::jsonb,
    'consulta exclui sobreposições e pausas e aceita adjacência, fechamento e meia-noite exatos');
select pg_temp.exigir(
    public.horarios_elegiveis('Barba teste', '10000000-0000-4000-8000-000000000002', pg_temp.dia())
      = '{"total":1,"horarios":["10:00"]}'::jsonb,
    'serviço mais longo cabe em menos horários de outro profissional');
select pg_temp.exigir(
    public.horarios_elegiveis('Corte teste', '10000000-0000-4000-8000-000000000002', pg_temp.dia())
      = '{"total":3,"horarios":["09:00","10:00","10:30"]}'::jsonb,
    'ocupação de outro profissional não bloqueia candidatos');
select pg_temp.exigir(
    public.horarios_elegiveis('Corte teste', '10000000-0000-4000-8000-000000000001', pg_temp.dia()+2)
      = '{"total":0,"horarios":[]}'::jsonb, 'data bloqueada');
select pg_temp.exigir(
    public.horarios_elegiveis('Corte teste', '10000000-0000-4000-8000-000000000001', pg_temp.dia()+6)
      = '{"total":0,"horarios":[]}'::jsonb, 'data fora da janela pública');
select pg_temp.exigir(
    public.horarios_elegiveis('Serviço inativo', '10000000-0000-4000-8000-000000000001', pg_temp.dia())
      = '{"total":0,"horarios":[]}'::jsonb, 'serviço inativo');
select pg_temp.exigir(
    public.horarios_elegiveis('Corte teste', '10000000-0000-4000-8000-000000000003', pg_temp.dia())
      = '{"total":0,"horarios":[]}'::jsonb, 'profissional inativo');
select pg_temp.erro_esperado('select inicio_em from public.agendamentos', '42501');
select pg_temp.erro_esperado(
    $$select pg_temp.reservar('10:30', 'Barba teste', '10000000-0000-4000-8000-000000000002')$$, '23514');
select pg_temp.erro_esperado(
    $$select pg_temp.reservar('11:30', 'Corte teste', '10000000-0000-4000-8000-000000000002')$$, '23514');
select pg_temp.erro_esperado(
    $$select pg_temp.reservar('15:30', 'Barba teste', '10000000-0000-4000-8000-000000000001')$$, '23514');
select pg_temp.erro_esperado(
    $$select pg_temp.reservar('23:45', 'Corte teste', '10000000-0000-4000-8000-000000000001')$$, '23514');
select pg_temp.erro_esperado(
    $$select pg_temp.reservar('09:00', 'Corte teste', '10000000-0000-4000-8000-000000000001', pg_temp.dia() + 2)$$, '23514');
select pg_temp.erro_esperado(
    $$select pg_temp.reservar('09:00', 'Serviço inativo', '10000000-0000-4000-8000-000000000001')$$, '23514');
select pg_temp.erro_esperado('select inicio_em from public.agendamentos_publicos', '42703');
select pg_temp.erro_esperado('select * from barberbook_private.janelas_expediente', '42501');

reset role;
select pg_temp.exigir(
    not has_column_privilege('barberbook_ocupacao', 'public.agendamentos', 'nome', 'SELECT')
    and not has_column_privilege('barberbook_ocupacao', 'public.agendamentos', 'whatsapp', 'SELECT')
    and not has_column_privilege('barberbook_ocupacao', 'public.agendamentos', 'preco', 'SELECT'),
    'papel da RPC não tem acesso a dados pessoais ou preços históricos');
update barberbook_private.servicos set duracao_minutos = 45, preco = 30 where codigo = 'Corte teste';
update barberbook_private.servicos set duracao_minutos = 90 where codigo = 'Barba teste';
select pg_temp.exigir(
    (select inicio_em = ((pg_temp.dia() + time '09:00') at time zone 'America/Sao_Paulo')
        and fim_em - inicio_em = interval '60 minutes' and duracao_minutos = 60
     from public.agendamentos where horario = '09:00'), 'instantes e duração no fuso IANA da loja');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select pg_temp.erro_esperado(
    $$update public.agendamentos set servico = 'Barba teste' where horario = '10:00'$$, '23514');
select pg_temp.erro_esperado('update public.agendamentos set duracao_minutos = 1', '42501');
select pg_temp.erro_esperado('select * from barberbook_private.referencias_intervalos_legados', '42501');
update public.agendamentos set nome = 'Contato corrigido' where horario = '09:00';
update public.agendamentos set data = pg_temp.dia() + 1, horario = '10:30' where horario = '10:00';
select pg_temp.exigir(
    (select preco = 'R$ 25,00' and duracao_minutos = 30 and fim_em - inicio_em = interval '30 minutes'
     from public.agendamentos where horario = '10:30'), 'remarcação preserva preço e duração contratados');
select pg_temp.exigir(
    (select preco = 'R$ 17,50' and duracao_minutos = 60 and fim_em - inicio_em = interval '60 minutes'
     from public.agendamentos where horario = '09:00'), 'edição de contato preserva intervalo');
update public.agendamentos set servico = 'Corte teste' where horario = '09:00';
select pg_temp.exigir(
    (select preco = 'R$ 30,00' and duracao_minutos = 45
     from public.agendamentos where horario = '09:00'), 'troca de serviço aplica catálogo atual');
select pg_temp.reservar('10:00', 'Corte teste', '10000000-0000-4000-8000-000000000001');
select pg_temp.erro_esperado(
    $$update public.agendamentos set servico = 'Barba teste' where horario = '09:00'$$, '23P01');
delete from public.agendamentos where horario = '09:00';
reset role;
set local role anon;
select pg_temp.reservar('09:00', 'Corte teste', '10000000-0000-4000-8000-000000000001');
reset role;

update barberbook_private.instalacao set fuso = 'America/Sao_Paulo';
select pg_temp.erro_esperado(
    $$update barberbook_private.instalacao set fuso = 'Asia/Tokyo'$$, '23514');
select pg_temp.erro_esperado('delete from barberbook_private.instalacao', '23514');
select pg_temp.erro_esperado('truncate barberbook_private.instalacao', '23514');
select pg_temp.exigir(
    (select i.fuso = 'America/Sao_Paulo' and a.data + a.horario = a.inicio_em at time zone i.fuso
        and a.fim_em - a.inicio_em = interval '45 minutes'
     from public.agendamentos a cross join barberbook_private.instalacao i
     where a.horario = '09:00'), 'bloqueio de alteração preserva horário civil e instantes');

-- A troca de fuso só pode ocorrer quando a agenda está vazia.
delete from public.agendamentos;
delete from barberbook_private.instalacao;
insert into barberbook_private.instalacao (fuso) values ('America/Sao_Paulo');
update barberbook_private.instalacao set fuso = 'America/New_York';
select pg_temp.exigir(
    (select fuso = 'America/New_York' from barberbook_private.instalacao), 'configuração de instalação sem reservas');
update public.dias_disponiveis set ativo = true;
insert into barberbook_private.janelas_expediente
select d, time '01:00', time '04:00' from generate_series(0, 6) d;
select min(current_date + dia) as dia_transicao
from generate_series(10, 500) dia
where barberbook_private.instante_civil(current_date + dia, '02:30', 'America/New_York') is null
\gset
select pg_temp.reservar('09:00', 'Corte teste', '10000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select pg_temp.erro_esperado(
    format('update public.agendamentos set data = %L, horario = ''02:30'' where horario = ''09:00''',
           :'dia_transicao'), '23514');
reset role;

rollback;
