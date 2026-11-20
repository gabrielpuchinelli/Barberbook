-- Dados fictícios para bancos descartáveis. Nunca aplicar junto ao provisionamento de uma loja.
insert into barberbook_private.instalacao (fuso) values ('America/Sao_Paulo');
select exists (
    select from information_schema.columns
    where table_schema = 'barberbook_private' and table_name = 'servicos' and column_name = 'duracao_minutos'
) as tem_intervalos \gset
\if :tem_intervalos
insert into barberbook_private.servicos (codigo, preco, ativo, duracao_minutos)
values ('Corte teste', 25, true, 30), ('Barba teste', 17.50, true, 60), ('Serviço inativo', 7, false, 15);
insert into barberbook_private.janelas_expediente (dia_semana, inicio, fim)
select dias.dia, janela.inicio, janela.fim
from generate_series(0, 6) dias(dia)
cross join (values (time '09:00', time '11:00'), (time '13:00', time '16:00'),
                   (time '23:30', time '24:00')) janela(inicio, fim);
\else
insert into barberbook_private.servicos (codigo, preco, ativo)
values ('Corte teste', 25, true), ('Barba teste', 17.50, true), ('Serviço inativo', 7, false);
\endif

insert into public.barbeiros (id, nome, ativo)
values ('10000000-0000-4000-8000-000000000001', 'Profissional A', true),
       ('10000000-0000-4000-8000-000000000002', 'Profissional B', true),
       ('10000000-0000-4000-8000-000000000003', 'Profissional inativo', false);

insert into auth.users (id)
values ('20000000-0000-4000-8000-000000000001'),
       ('20000000-0000-4000-8000-000000000002'),
       ('20000000-0000-4000-8000-000000000003'),
       ('20000000-0000-4000-8000-000000000004'),
       ('20000000-0000-4000-8000-000000000005');

insert into barberbook_private.perfis (user_id, papel, barbeiro_id)
values ('20000000-0000-4000-8000-000000000001', 'admin', null),
       ('20000000-0000-4000-8000-000000000002', 'barbeiro', '10000000-0000-4000-8000-000000000001'),
       ('20000000-0000-4000-8000-000000000003', 'barbeiro', '10000000-0000-4000-8000-000000000002'),
       ('20000000-0000-4000-8000-000000000005', 'barbeiro', '10000000-0000-4000-8000-000000000003');

insert into public.dias_disponiveis (dia_semana, ativo)
select dia, dia <> extract(dow from (statement_timestamp() at time zone 'America/Sao_Paulo')::date + 4)
from generate_series(0, 6) dia;
insert into public.horarios_disponiveis (horario, ativo)
values ('09:00', true), ('09:30', true), ('10:00', true), ('11:00', false);
insert into public.datas_bloqueadas (data)
values ((statement_timestamp() at time zone 'America/Sao_Paulo')::date + 3);
