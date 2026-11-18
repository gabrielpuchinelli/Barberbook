# Instruções para agentes — BarberBook

## Contexto e objetivo
BarberBook é um sistema de agendamento e administração de barbearias, preparado para comercialização **por implantação individual**. Cada cliente deve ter sua própria implantação e projeto Supabase. Não implementar multi-tenancy ou cobrança SaaS sem solicitação explícita.

## Estado atual
- Frontend: HTML, CSS e JavaScript sem bundler; entrada em `index.html`.
- Estilos: `css/style.css`, `css/responsividade.css` e tema incremental `css/azul-noturno.css` (carregado por último).
- Comportamento: principalmente `js/script.js`; `js/config.js` inicializa o cliente Supabase.
- Backend: Supabase Auth e PostgreSQL; `supabase-schema.sql` **não é fonte completa e confiável do banco implantado**.
- Consulte `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` e `docs/DESIGN_SYSTEM.md` antes de mudanças relevantes.

## Regras obrigatórias
1. Trabalhar na branch `main`, conforme decisão do proprietário, com alterações pequenas e commits descritivos. Não fazer push sem verificar o diff.
2. Antes de alterações estruturais, descrever plano, arquivos afetados, riscos e testes; aguardar aprovação.
3. Preservar agendamento, seleção de barbeiro, disponibilidade, bloqueios, login, permissões, painel, indicadores, faturamento, edição, exclusão, busca e exportação CSV.
4. Não renomear/remover IDs, classes ou atributos `data-*` usados pelo JavaScript sem atualizar e testar os consumidores.
5. Não alterar schema, políticas RLS, autenticação ou dados reais no Supabase sem aprovação, backup e verificação da estrutura implantada.
6. Nunca inserir service-role keys, senhas ou credenciais privadas no frontend, Git ou logs. A chave pública anon não substitui políticas RLS corretas.
7. Evitar exibir dados pessoais (nome, WhatsApp) em consultas públicas. Auditar a view `agendamentos_publicos` e as permissões antes de comercializar.
8. Não introduzir React, TypeScript, dependências ou ferramentas de build sem aprovação específica. Priorizar refatoração incremental.
9. Manter interface responsiva, navegação por teclado, foco visível, contraste e estados de erro/carregamento.
10. Não afirmar que testes passaram sem executá-los. Informar claramente limitações do ambiente e validações manuais pendentes.

## Fluxo de trabalho
- Ler o código relevante e mapear dependências.
- Apresentar implementação incremental e critérios de aceitação.
- Após aprovação, alterar o mínimo necessário e executar testes possíveis.
- Conferir `git diff`, evitar regressões e atualizar a documentação quando houver mudança de comportamento/arquitetura.
- Entregar resumo dos arquivos alterados, riscos, testes realizados e próximos passos.

## Direção visual
Tema **Azul Noturno**, com tokens e diretrizes em `docs/DESIGN_SYSTEM.md`. Preservar o tema atual enquanto evoluímos agendamento e painel.

## Segurança — prioridade máxima
O SQL versionado contém políticas potencialmente permissivas para o papel `anon` e uma restrição global de data/horário. O JavaScript também usa tabelas, view e RPCs ausentes desse SQL. Não presumir que o banco real tenha o mesmo schema: primeiro auditar e registrar divergências.
