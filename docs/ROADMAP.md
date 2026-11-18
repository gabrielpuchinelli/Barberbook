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
- [ ] Obter schema real do Supabase e comparar com `supabase-schema.sql`.
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
- [ ] Organizar navegação e seções do painel.
- [ ] Modernizar indicadores, lista/agenda e filtros.
- [ ] Preservar operações de edição, exclusão, bloqueios e CSV.
- [ ] Verificar permissões de administrador e barbeiro.

## Fase 4 — Preparação comercial
- [ ] Parametrizar nome, logo, contato, serviços, preços e horários por instalação.
- [ ] Padronizar configuração segura do Supabase e provisionamento.
- [ ] Documentar instalação, backup, atualização e suporte.
- [ ] Executar testes de regressão e checklist de segurança.

## Fase 5 — Evolução opcional
- [ ] Avaliar React + TypeScript, conforme benefício e aprovação.
- [ ] Introduzir automação de testes e integração contínua.
- [ ] Melhorar observabilidade e procedimentos de manutenção.

## Próxima tarefa para o Codex
Obter o inventário do Supabase implantado, confirmar o contrato da view pública e validar as permissões e os fluxos críticos em ambiente de teste. A modernização das etapas do agendamento e das seções do painel segue nos próximos incrementos.
