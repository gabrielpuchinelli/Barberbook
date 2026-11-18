# Design system — Azul Noturno

## Objetivo
Identidade moderna e profissional para o BarberBook, consistente entre agendamento público, login e painel administrativo. O sistema será personalizável por implantação futuramente.

## Tokens principais
| Uso | Cor |
| --- | --- |
| Fundo principal | `#0B1523` |
| Superfície | `#14253A` |
| Superfície elevada | `#1B3049` |
| Borda | `#2C4661` |
| Ação/destaque | `#68A9D4` |
| Destaque claro | `#91C8ED` |
| Texto principal | `#F4F8FC` |
| Texto secundário | `#A9BFD2` |

Tokens CSS estão declarados em `css/azul-noturno.css`, carregado após os estilos legados. Preferir reutilizar variáveis `--bb-*` e evitar novos hexadecimais espalhados pelo código.

## Componentes
- **Botões:** primário azul, texto escuro e foco visível; secundário com superfície azul-acinzentada.
- **Cards:** superfícies azul-escuras, borda sutil, raio arredondado e sombra moderada.
- **Inputs:** fundo contrastante, rótulos explícitos e estados de foco/erro.
- **Seleção:** estados padrão, hover, selecionado e indisponível visualmente distinguíveis.
- **Tabelas e indicadores:** hierarquia tipográfica clara, espaçamento consistente e rolagem horizontal em telas pequenas.

## Agendamento
Experiência desejada: serviço → profissional → data/horário → confirmação. Os indicadores de etapas adicionados em `index.html` são **apenas apresentação estática inicial**; não refletem automaticamente o estado do fluxo. Torná-los dinâmicos somente durante a refatoração funcional, com testes.

## Painel
Priorizar visão geral, agenda, agendamentos, disponibilidade e configurações. Manter os IDs e eventos existentes até migração controlada.

## Acessibilidade e responsividade
- Manter contraste adequado e foco por teclado.
- Não comunicar seleção ou indisponibilidade somente por cor.
- Usar labels e mensagens acessíveis em formulários.
- Considerar telas de 320 px até desktop; evitar overflow em cards e formulários.
- Respeitar `prefers-reduced-motion`.
- Não esconder ações críticas apenas no hover.

## Critérios de aceite visual
- Agendamento, login e painel coerentes com a mesma paleta.
- Nenhuma funcionalidade anterior removida.
- Elementos interativos distinguíveis e operáveis por teclado.
- Sem sobreposição ou corte de conteúdo em mobile.
- Verificação real em navegador antes de considerar a entrega validada.
