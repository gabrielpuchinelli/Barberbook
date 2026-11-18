-- Modelo de configuração inicial. Revise preços, horários e fuso antes do uso.
-- Aplicação manual por operador. Nenhum usuário, profissional ou cliente é criado aqui.
begin;

insert into barberbook_private.instalacao (fuso) values ('America/Sao_Paulo');

-- Os códigos precisam coincidir com data-servico no HTML enquanto o catálogo
-- não for carregado pelo frontend.
insert into barberbook_private.servicos (codigo, preco)
values ('Corte na maquina', 25), ('Corte com tesoura', 30), ('Navalhado', 30),
       ('Corte pente unico', 15), ('Barba', 10), ('pezinho', 10),
       ('Sobrancelha', 5), ('Pigmentacao', 10), ('reflexo', 60),
       ('Luzes', 60), ('Nevou', 70);

insert into public.dias_disponiveis (dia_semana, ativo)
values (0, false), (1, true), (2, true), (3, true), (4, true), (5, true), (6, true);

insert into public.horarios_disponiveis (horario)
values ('09:00'), ('09:30'), ('10:00'), ('10:30'), ('11:00'), ('11:30'),
       ('13:00'), ('13:30'), ('14:00'), ('14:30'), ('15:00'), ('15:30'),
       ('16:00'), ('16:30'), ('17:00'), ('17:30'), ('18:00'), ('18:30'), ('19:00');

commit;
