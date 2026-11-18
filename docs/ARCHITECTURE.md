# Arquitetura — BarberBook

## Modelo comercial
Produto distribuído por **instalação individual por cliente**. A proposta é manter uma base de código versionada, com implantação e projeto Supabase separados para cada barbearia. Não há necessidade de `tenant_id` nesta etapa.

## Arquitetura observada no repositório
- `index.html`: página pública de serviços e agendamento, login e painel administrativo no mesmo documento.
- `css/style.css`: estilos legados; `css/responsividade.css`: ajustes responsivos; `css/azul-noturno.css`: nova camada visual.
- `js/config.js`: configuração do cliente Supabase no navegador.
- `js/script.js`: fluxo de agendamento, persistência, autenticação, permissões, disponibilidade e painel.
- `js/agendamento.js` e `js/admin.js`: scripts adicionais de pequeno porte; verificar seus papéis antes de reorganizar.
- `supabase-schema.sql`: representação **parcial/desatualizada** do banco, não migração completa validada.
- `localStorage`: utilizado como cache/fallback em partes do frontend; não deve ser fonte de autoridade para disponibilidade ou permissões.

## Recursos Supabase referenciados pelo frontend
- Tabelas: `agendamentos`, `barbeiros`, `dias_disponiveis`, `horarios_disponiveis`, `datas_bloqueadas`.
- View: `agendamentos_publicos`.
- RPCs: `eh_admin`, `eh_barbeiro`, `barbeiro_atual_id`.
- Autenticação: Supabase Auth com login por e-mail e senha.

**Atenção:** nem todos esses recursos estão definidos em `supabase-schema.sql`. É necessário obter o schema efetivo, as grants, políticas RLS e definições de views/funções do projeto Supabase antes de qualquer migração.

## Riscos técnicos conhecidos
1. O SQL versionado contém políticas que permitem operações de escrita para `anon` em tabelas sensíveis. Verificar se essas políticas estão efetivamente implantadas e corrigi-las de forma segura.
2. A restrição `unique(data, horario)` do SQL versionado não considera o profissional; pode bloquear agendamentos simultâneos de barbeiros distintos.
3. Serviços, preços e informações da barbearia estão codificados no HTML; deverão migrar para configuração por implantação.
4. O arquivo `js/script.js` concentra muitas responsabilidades.
5. A consulta pública de agendamentos precisa expor somente dados indispensáveis, sem nome/WhatsApp de clientes.
6. A duração dos serviços ainda precisa ser considerada no modelo de conflitos.

## Direção de evolução
- **Primeiro:** inventariar contratos do DOM, regras e schema; auditar acesso aos dados.
- **Depois:** separar funcionalidades em módulos JS mantendo compatibilidade e testes.
- **Interface:** fluxo de serviço → profissional → data/horário → confirmação, com estados claros.
- **Painel:** seções para visão geral, agenda, atendimentos, disponibilidade e configurações, preservando controles existentes.
- **Futuro opcional:** avaliar React + TypeScript apenas após decisão explícita e plano de migração.

## Critérios para uma implantação comercial
Permissões verificadas no banco real; ausência de acesso público a dados pessoais; prevenção de conflito de horários no servidor; autenticação validada; testes de fluxos críticos; configuração por barbearia; backup, documentação e procedimento de atualização.
