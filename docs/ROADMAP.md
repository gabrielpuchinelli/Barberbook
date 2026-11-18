# Roadmap — BarberBook

## Premissas
- Comercialização: implantação individual por barbearia.
- Branch de trabalho: `main` (decisão do proprietário).
- Identidade visual: Azul Noturno.
- Implementações incrementais, com revisão e testes antes de commits.
- Não alterar o banco real sem inventário, backup e aprovação.

## Fase 1 — Auditoria e preparação
- [x] Definir modelo comercial individual.
- [x] Escolher identidade Azul Noturno.
- [x] Aplicar camada inicial de estilo e atualizar apresentação em `index.html`.
- [x] Documentar instruções, arquitetura, roadmap e design system.
- [ ] Inventariar todas as regras e eventos de `js/script.js`.
- [x] Separar a ocupação pública dos registros privados no frontend e remover o cache legado de agendamentos do navegador.
- [x] Inventariar contratos do frontend após a exclusão do Supabase anterior.
- [ ] Auditar RLS, grants, view pública, RPCs e tratamento de dados pessoais.
- [ ] Definir plano de testes e critérios de aceite para agendamentos.
- [ ] Validar visualmente as telas em desktop e dispositivos móveis.

## Fase 2 — Agendamento renovado
- [x] Mapear estados e dependências do fluxo atual.
- [x] Implementar seleção de serviço e profissional com feedback claro.
- [x] Melhorar a seleção de datas e horários, preservando as regras de disponibilidade.
- [x] Exibir resumo e confirmação com tratamento de erros e trava de envio.
- [x] Testar bloqueios, conflitos, navegação e responsividade no navegador com dados simulados.
- [x] Validar por emulação o toque e a altura reduzida de teclado nas larguras de 320, 360, 375 e 390 px.
- [ ] Validar o teclado e o fluxo público em smartphones, incluindo os navegadores internos do WhatsApp e do Instagram.
- [ ] Validar o fluxo e a concorrência com um projeto Supabase de teste após a auditoria.

## Fase 3 — Painel administrativo renovado
- [x] Organizar a navegação mobile-first com Agenda, Agendamentos, Disponibilidade e Faturamento.
- [x] Exibir os atendimentos de hoje e os próximos, com atualização automática na virada do dia.
- [x] Compartilhar os filtros entre cartões, tabela e CSV e preservar edição, exclusão e controles de disponibilidade.
- [x] Testar os fluxos administrativos com permissões e requisições simuladas a 320, 360, 375, 390 e 1200 px. Reexecutar a regressão do agendamento público.
- [ ] Verificar permissões e concorrência com contas de administrador e barbeiro em um projeto Supabase de teste.

## Fase 4 — Preparação comercial
- [x] Reconstruir o schema em migrações versionadas e separar a configuração inicial dos dados fictícios.
- [x] Exercitar permissões, integridade e concorrência em PostgreSQL local descartável.
- [x] Validar instalação, Auth, RPCs, permissões e concorrência pela Data API no stack Supabase local.
- [ ] Parametrizar nome, logo, contato, serviços, preços e horários por instalação.
- [ ] Padronizar configuração segura do Supabase e provisionamento.
- [ ] Documentar instalação, backup, atualização e suporte.
- [ ] Executar testes de regressão e checklist de segurança.

### Pendências de integração

- [ ] Tratar exclusões e edições que afetam zero linhas e atualizar a interface somente após confirmação da operação.
- [ ] Alinhar a exibição de datas e horários ao fuso da barbearia quando ele difere do fuso do navegador.
- [ ] Paginar as consultas da Data API para ocupação pública e histórico administrativo.
- [ ] Definir e testar proteção contra abuso de reservas públicas.
- [ ] Validar a interface de agendamento e painel de ponta a ponta no navegador com um stack Supabase real de teste.
- [ ] Definir e validar as regras de conflito para serviços com durações sobrepostas.

## Fase 5 — Evolução opcional
- [ ] Avaliar React + TypeScript, conforme benefício e aprovação.
- [ ] Introduzir automação de testes e integração contínua.
- [ ] Melhorar observabilidade e procedimentos de manutenção.

## Próxima tarefa para o Codex
Após a revisão do schema, priorizar as pendências de integração e validar a interface completa no navegador com dados fictícios.
