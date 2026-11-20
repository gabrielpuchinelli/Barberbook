-- Modelo de configuração inicial. Revise preços, horários e fuso antes do uso.
-- Aplicação manual por operador. Nenhum usuário, profissional ou cliente é criado aqui.
begin;

insert into barberbook_private.instalacao (fuso) values ('America/Sao_Paulo');

-- Os códigos precisam coincidir com data-servico no HTML enquanto o catálogo
-- não for carregado pelo frontend.
-- Durações ilustrativas para novas instalações. Confirme com a loja antes do uso.
insert into barberbook_private.servicos (codigo, preco, duracao_minutos)
values ('Corte na maquina', 25, 30), ('Corte com tesoura', 30, 45), ('Navalhado', 30, 45),
       ('Corte pente unico', 15, 20), ('Barba', 10, 20), ('pezinho', 10, 15),
       ('Sobrancelha', 5, 15), ('Pigmentacao', 10, 30), ('reflexo', 60, 60),
       ('Luzes', 60, 90), ('Nevou', 70, 90);

insert into public.dias_disponiveis (dia_semana, ativo)
values (0, false), (1, true), (2, true), (3, true), (4, true), (5, true), (6, true);

insert into barberbook_private.janelas_expediente (dia_semana, inicio, fim)
select dias.dia_semana, j.inicio, j.fim
from generate_series(1, 6) as dias(dia_semana)
cross join (values (time '09:00', time '12:00'), (time '13:00', time '19:30')) as j(inicio, fim);

insert into public.horarios_disponiveis (horario)
values ('09:00'), ('09:30'), ('10:00'), ('10:30'), ('11:00'), ('11:30'),
       ('13:00'), ('13:30'), ('14:00'), ('14:30'), ('15:00'), ('15:30'),
       ('16:00'), ('16:30'), ('17:00'), ('17:30'), ('18:00'), ('18:30'), ('19:00');

commit;
