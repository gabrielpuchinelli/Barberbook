-- BarberBook — instalação inicial via psql em um projeto Supabase vazio.
-- As migrações versionadas são a fonte de verdade. Aplique-as pelo fluxo de
-- migrações do Supabase ou por este arquivo. Não aplique pelos dois caminhos.
-- O SQL Editor não interpreta as diretivas do psql.
\set ON_ERROR_STOP on
\ir supabase/migrations/20261118000100_estrutura.sql
\ir supabase/migrations/20261118000200_integridade.sql
\ir supabase/migrations/20261118000300_acesso.sql
\ir supabase/migrations/20261120000100_preparar_intervalos.sql
\ir supabase/migrations/20261120000200_ativar_intervalos.sql
\ir supabase/migrations/20261120000300_horarios_elegiveis.sql
\ir supabase/migrations/20261120000400_preparar_protecao_reservas.sql
\ir supabase/migrations/20261120000500_fechar_insert_publico.sql
