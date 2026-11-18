begin;

-- Helpers de identidade ficam fora dos schemas expostos pela Data API.
create function barberbook_private.papel_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select p.papel
    from barberbook_private.perfis p
    left join public.barbeiros b on b.id = p.barbeiro_id
    where p.user_id = (select auth.uid()) and p.ativo
      and (p.papel = 'admin' or b.ativo)
$$;

create function barberbook_private.barbeiro_id_atual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select p.barbeiro_id
    from barberbook_private.perfis p
    join public.barbeiros b on b.id = p.barbeiro_id and b.ativo
    where p.user_id = (select auth.uid()) and p.ativo and p.papel = 'barbeiro'
$$;

create function public.eh_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select coalesce(barberbook_private.papel_atual() = 'admin', false) $$;

create function public.eh_barbeiro()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select barberbook_private.barbeiro_id_atual() is not null $$;

create function public.barbeiro_atual_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$ select barberbook_private.barbeiro_id_atual() $$;

revoke all on function barberbook_private.papel_atual(), barberbook_private.barbeiro_id_atual(),
    public.eh_admin(), public.eh_barbeiro(), public.barbeiro_atual_id()
    from public, anon, authenticated, service_role;
grant usage on schema barberbook_private to authenticated;
grant execute on function barberbook_private.papel_atual(), barberbook_private.barbeiro_id_atual(),
    public.eh_admin(), public.eh_barbeiro(), public.barbeiro_atual_id() to authenticated;

create policy listar_barbeiros_ativos on public.barbeiros
    for select to anon, authenticated using (ativo);
create policy ler_dias on public.dias_disponiveis for select to anon, authenticated using (true);
create policy ler_horarios on public.horarios_disponiveis for select to anon, authenticated using (true);
create policy ler_bloqueios on public.datas_bloqueadas for select to anon, authenticated using (true);

grant select (id, nome, ativo) on public.barbeiros to anon, authenticated;
grant select on public.dias_disponiveis, public.horarios_disponiveis,
    public.datas_bloqueadas to anon, authenticated;

-- O mesmo papel PostgreSQL authenticated atende os dois perfis. RLS decide as linhas.
create policy ler_agendamentos_da_equipe on public.agendamentos for select to authenticated
    using (
        (select public.eh_admin()) or barbeiro_id = (select public.barbeiro_atual_id())
    );
create policy editar_agendamentos_da_equipe on public.agendamentos for update to authenticated
    using (
        (select public.eh_admin()) or barbeiro_id = (select public.barbeiro_atual_id())
    )
    with check (
        (select public.eh_admin()) or barbeiro_id = (select public.barbeiro_atual_id())
    );
create policy excluir_agendamentos_da_equipe on public.agendamentos for delete to authenticated
    using (
        (select public.eh_admin()) or barbeiro_id = (select public.barbeiro_atual_id())
    );
create policy criar_reserva_publica on public.agendamentos for insert to anon, authenticated
    with check (
        exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.ativo)
    );

-- Payload legado aceito. O trigger determina preco e barbeiro_nome antes da gravação.
grant insert (nome, whatsapp, servico, preco, data, horario, barbeiro_id, barbeiro_nome)
    on public.agendamentos to anon, authenticated;
grant select, delete on public.agendamentos to authenticated;
grant update (nome, whatsapp, servico, data, horario) on public.agendamentos to authenticated;

create policy inserir_dia_admin on public.dias_disponiveis for insert to authenticated
    with check ((select public.eh_admin()));
create policy editar_dia_admin on public.dias_disponiveis for update to authenticated
    using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy inserir_horario_admin on public.horarios_disponiveis for insert to authenticated
    with check ((select public.eh_admin()));
create policy editar_horario_admin on public.horarios_disponiveis for update to authenticated
    using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy excluir_horario_admin on public.horarios_disponiveis for delete to authenticated
    using ((select public.eh_admin()));
create policy inserir_bloqueio_admin on public.datas_bloqueadas for insert to authenticated
    with check ((select public.eh_admin()));
create policy excluir_bloqueio_admin on public.datas_bloqueadas for delete to authenticated
    using ((select public.eh_admin()));

-- O upsert do frontend reenvia a chave quando atualiza a linha existente.
grant insert (dia_semana, ativo), update (dia_semana, ativo) on public.dias_disponiveis to authenticated;
grant insert (horario, ativo), update (horario, ativo), delete on public.horarios_disponiveis to authenticated;
grant insert (data), delete on public.datas_bloqueadas to authenticated;

-- Proprietário da view tem apenas a projeção de ocupação. Ele não possui a tabela
-- e não ignora RLS. Nenhum papel da API pode assumi-lo.
grant select (data, horario, barbeiro_id) on public.agendamentos to barberbook_ocupacao;
create policy ler_ocupacao_na_janela on public.agendamentos for select to barberbook_ocupacao
    using (
        data >= (select (statement_timestamp() at time zone i.fuso)::date
                 from barberbook_private.instalacao i)
        and data <= (select (statement_timestamp() at time zone i.fuso)::date + 6
                     from barberbook_private.instalacao i)
    );

create view public.agendamentos_publicos
    with (security_barrier = true, security_invoker = false)
as select data, horario, barbeiro_id from public.agendamentos;

revoke all on public.agendamentos_publicos from public, anon, authenticated, service_role;
grant select on public.agendamentos_publicos to anon, authenticated;
grant create on schema public to barberbook_ocupacao;
alter view public.agendamentos_publicos owner to barberbook_ocupacao;
revoke create on schema public from barberbook_ocupacao;

commit;
