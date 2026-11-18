-- BarberBook — instalação inicial via psql em um projeto Supabase vazio.
-- As migrações versionadas são a fonte de verdade. Aplique-as pelo fluxo de
-- migrações do Supabase ou por este arquivo. Não aplique pelos dois caminhos.
-- O SQL Editor não interpreta as diretivas do psql.
\set ON_ERROR_STOP on
\ir supabase/migrations/20261118000100_estrutura.sql
\ir supabase/migrations/20261118000200_integridade.sql
\ir supabase/migrations/20261118000300_acesso.sql
