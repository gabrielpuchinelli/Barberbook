begin;

-- Projeto novo. Revoga defaults do papel que aplica as migrações.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges in schema public revoke all on functions from anon, authenticated, service_role;
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

create schema barberbook_private;
revoke all on schema barberbook_private from public, anon, authenticated, service_role;

create table barberbook_private.instalacao (
    id boolean primary key default true check (id),
    fuso text not null
);

create function barberbook_private.validar_fuso()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.fuso) then
        raise exception using errcode = '22023', message = 'Fuso horário inválido.';
    end if;
    return new;
end;
$$;

create trigger validar_fuso
before insert or update of fuso on barberbook_private.instalacao
for each row execute function barberbook_private.validar_fuso();

create table barberbook_private.servicos (
    codigo text primary key check (codigo = btrim(codigo) and char_length(codigo) between 1 and 120),
    preco numeric(10, 2) not null check (preco between 0 and 99999999.99),
    ativo boolean not null default true
);

create table public.barbeiros (
    id uuid primary key default gen_random_uuid(),
    nome text not null check (nome = btrim(nome) and char_length(nome) between 1 and 120),
    ativo boolean not null default true
);

create table barberbook_private.perfis (
    user_id uuid primary key references auth.users(id) on delete cascade,
    papel text not null check (papel in ('admin', 'barbeiro')),
    barbeiro_id uuid unique references public.barbeiros(id) on delete restrict,
    ativo boolean not null default true,
    check ((papel = 'barbeiro') = (barbeiro_id is not null))
);

create table public.dias_disponiveis (
    dia_semana smallint primary key check (dia_semana between 0 and 6),
    ativo boolean not null default true
);

create table public.horarios_disponiveis (
    horario time without time zone primary key
        check (horario < time '24:00' and extract(second from horario) = 0),
    ativo boolean not null default true
);

create table public.datas_bloqueadas (
    data date primary key check (isfinite(data))
);

create table public.agendamentos (
    id bigint generated always as identity primary key,
    nome text not null check (char_length(nome) between 1 and 120 and nome !~ '[[:cntrl:]]'),
    whatsapp text not null check (whatsapp ~ '^[+]?[0-9]{10,15}$'),
    servico text not null references barberbook_private.servicos(codigo) on delete restrict,
    preco text not null,
    data date not null check (isfinite(data)),
    horario time without time zone not null
        check (horario < time '24:00' and extract(second from horario) = 0),
    barbeiro_id uuid not null references public.barbeiros(id) on delete restrict,
    barbeiro_nome text not null,
    criado_em timestamptz not null default now(),
    constraint agendamentos_profissional_data_horario_key unique (barbeiro_id, data, horario)
);

create index agendamentos_data_horario_id_idx on public.agendamentos (data, horario, id);
create index agendamentos_servico_idx on public.agendamentos (servico);

alter table public.agendamentos enable row level security;
alter table public.barbeiros enable row level security;
alter table public.dias_disponiveis enable row level security;
alter table public.horarios_disponiveis enable row level security;
alter table public.datas_bloqueadas enable row level security;
alter table barberbook_private.instalacao enable row level security;
alter table barberbook_private.servicos enable row level security;
alter table barberbook_private.perfis enable row level security;

-- Nenhuma tabela nova fica disponível à API antes da migração de acesso.
revoke all on public.agendamentos, public.barbeiros, public.dias_disponiveis,
    public.horarios_disponiveis, public.datas_bloqueadas from public, anon, authenticated, service_role;
revoke all on sequence public.agendamentos_id_seq from public, anon, authenticated, service_role;
revoke all on barberbook_private.instalacao, barberbook_private.servicos, barberbook_private.perfis
    from public, anon, authenticated, service_role;
revoke all on function barberbook_private.validar_fuso() from public, anon, authenticated, service_role;

commit;
