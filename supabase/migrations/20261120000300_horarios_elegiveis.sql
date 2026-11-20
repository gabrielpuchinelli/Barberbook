begin;

-- Reutiliza o papel restrito à ocupação pública e à janela de sete dias.
grant select (inicio_em, fim_em, legado_sem_intervalo) on public.agendamentos to barberbook_ocupacao;
grant select (codigo, duracao_minutos, ativo) on barberbook_private.servicos to barberbook_ocupacao;
grant select (dia_semana, inicio, fim) on barberbook_private.janelas_expediente to barberbook_ocupacao;
grant select (id, ativo) on public.barbeiros to barberbook_ocupacao;
grant select (dia_semana, ativo) on public.dias_disponiveis to barberbook_ocupacao;
grant select (horario, ativo) on public.horarios_disponiveis to barberbook_ocupacao;
grant select (data) on public.datas_bloqueadas to barberbook_ocupacao;
grant execute on function barberbook_private.instante_civil(date, time, text),
    barberbook_private.intervalo_atendimento(date, time, integer, text) to barberbook_ocupacao;

create policy consultar_servicos_ativos on barberbook_private.servicos
    for select to barberbook_ocupacao using (ativo);
create policy consultar_expediente on barberbook_private.janelas_expediente
    for select to barberbook_ocupacao using (true);
create policy consultar_profissionais_ativos on public.barbeiros
    for select to barberbook_ocupacao using (ativo);
create policy consultar_dias_ativos on public.dias_disponiveis
    for select to barberbook_ocupacao using (ativo);
create policy consultar_horarios_ativos on public.horarios_disponiveis
    for select to barberbook_ocupacao using (ativo);
create policy consultar_datas_bloqueadas on public.datas_bloqueadas
    for select to barberbook_ocupacao using (true);

create function public.horarios_elegiveis(p_servico text, p_barbeiro_id uuid, p_data date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    -- A projeção escalar mantém todos os horários na mesma resposta da Data API.
    select jsonb_build_object(
        'total', count(*),
        'horarios', coalesce(jsonb_agg(to_char(p_data + h.horario, 'HH24:MI') order by h.horario), '[]'::jsonb)
    )
    from barberbook_private.instalacao i
    join barberbook_private.servicos s on s.codigo = p_servico and s.ativo
    join public.barbeiros b on b.id = p_barbeiro_id and b.ativo
    join public.dias_disponiveis d on d.dia_semana = extract(dow from p_data) and d.ativo
    cross join public.horarios_disponiveis h
    cross join lateral (
        select barberbook_private.intervalo_atendimento(p_data, h.horario, s.duracao_minutos, i.fuso)
    ) candidato(intervalo)
    where p_data between (statement_timestamp() at time zone i.fuso)::date
                     and (statement_timestamp() at time zone i.fuso)::date + 6
      and h.ativo
      and lower(candidato.intervalo) > statement_timestamp()
      and not exists (select 1 from public.datas_bloqueadas db where db.data = p_data)
      and exists (
          select 1 from barberbook_private.janelas_expediente j
          where j.dia_semana = d.dia_semana
            and lower(candidato.intervalo) >= barberbook_private.instante_civil(p_data, j.inicio, i.fuso)
            and upper(candidato.intervalo) <= barberbook_private.instante_civil(p_data, j.fim, i.fuso)
      )
      and not exists (
          select 1 from public.agendamentos a
          where a.barbeiro_id = b.id and not a.legado_sem_intervalo
            and tstzrange(a.inicio_em, a.fim_em, '[)') && candidato.intervalo
      )
      and not exists (
          select 1 from public.agendamentos a
          where a.barbeiro_id = b.id and a.data = p_data and a.horario = h.horario
      )
$$;

revoke all on function public.horarios_elegiveis(text, uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.horarios_elegiveis(text, uuid, date) to anon, authenticated;
grant create on schema public to barberbook_ocupacao;
alter function public.horarios_elegiveis(text, uuid, date) owner to barberbook_ocupacao;
revoke create on schema public from barberbook_ocupacao;

commit;
