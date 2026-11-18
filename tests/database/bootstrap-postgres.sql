-- Apenas para PostgreSQL descartável sem Supabase Auth.
-- O mecanismo de grants/RLS é o real do PostgreSQL. Auth e Data API não são exercitados.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);

create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;

-- Exercita a revogação dos defaults amplos em um cluster recém-criado.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
