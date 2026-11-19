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
- [x] Validar o fluxo e a concorrência com um projeto Supabase local de teste.

## Fase 3 — Painel administrativo renovado
- [x] Organizar a navegação mobile-first com Agenda, Agendamentos, Disponibilidade e Faturamento.
- [x] Exibir os atendimentos de hoje e os próximos, com atualização automática na virada do dia.
- [x] Compartilhar os filtros entre cartões, tabela e CSV e preservar edição, exclusão e controles de disponibilidade.
- [x] Testar os fluxos administrativos com permissões e requisições simuladas a 320, 360, 375, 390 e 1200 px. Reexecutar a regressão do agendamento público.
- [x] Verificar permissões com contas de administrador e barbeiro no navegador e concorrência pela Data API do Supabase local.

## Fase 4 — Preparação comercial
- [x] Reconstruir o schema em migrações versionadas e separar a configuração inicial dos dados fictícios.
- [x] Exercitar permissões, integridade e concorrência em PostgreSQL local descartável.
- [x] Validar instalação, Auth, RPCs, permissões e concorrência pela Data API no stack Supabase local.
- [ ] Parametrizar nome, logo, contato, serviços, preços e horários por instalação.
- [ ] Padronizar configuração segura do Supabase e provisionamento.
- [ ] Documentar instalação, backup, atualização e suporte.
- [ ] Executar testes de regressão e checklist de segurança.

### Integração da interface com o Supabase

- [x] Tratar exclusões e edições que afetam zero linhas e atualizar a interface somente após confirmação da operação.
- [x] Usar o fuso IANA da barbearia na exibição e na validação temporal, incluindo a virada do dia.
- [x] Conferir o fuso, os códigos e os preços publicados com a configuração de cada instalação.
- [x] Paginar as consultas da Data API e bloquear a disponibilidade se uma página necessária falhar.
- [x] Validar reservas em Chrome com toque emulado a 320, 360, 375 e 390 px e validar autenticação, permissões e operações administrativas com um stack Supabase local.
- [ ] Definir e testar proteção contra abuso de reservas públicas.
- [ ] Definir e validar as regras de conflito para serviços com durações sobrepostas.

## Fase 5 — Evolução opcional
- [ ] Avaliar React + TypeScript, conforme benefício e aprovação.
- [ ] Introduzir automação de testes e integração contínua.
- [ ] Melhorar observabilidade e procedimentos de manutenção.

## Próxima tarefa para o Codex
Após a revisão da integração, priorizar a proteção contra abuso e as validações em smartphones físicos.
