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
O fluxo apresenta uma etapa por vez, de serviço a profissional, data e horário e confirmação. O progresso permanece visível e marca a etapa ativa com `aria-current="step"`. Ao avançar ou voltar, o foco vai para o título da etapa. O botão **Voltar** mantém as escolhas válidas.

Datas bloqueadas e horários ocupados têm rótulos próprios. A confirmação apresenta serviço, preço, profissional, data e horário antes dos campos de contato. Durante o envio, um estado textual informa que a reserva está sendo confirmada.

## Painel
A navegação abre em **Agenda**, com listas separadas para hoje e próximos atendimentos. **Agendamentos**, **Disponibilidade** e **Faturamento** ficam em seções próprias. Ao mudar de seção, o foco vai para o título.

Em telas estreitas, cada agendamento fica em um cartão com ações visíveis e alvos de pelo menos 44 × 44 px. Em telas largas, a tabela usa o mesmo resultado filtrado dos cartões e do CSV. A edição move o foco para o formulário e retorna à ação de editar, ou ao título da seção se o registro sair do filtro.

## Acessibilidade e responsividade
- Manter contraste adequado e foco por teclado.
- Não comunicar seleção ou indisponibilidade somente por cor.
- Usar labels e mensagens acessíveis em formulários.
- Começar o layout do agendamento por 320, 360, 375 e 390 px. Usar alvos de toque de pelo menos 44 × 44 px e campos com fonte de 16 px.
- Manter a confirmação no fluxo da página, abaixo dos campos. Usar entrada telefônica no WhatsApp e permitir rolagem quando a área útil diminui com o teclado.
- Usar painéis e grades que cabem na largura disponível, com mais colunas em telas maiores.
- Respeitar `prefers-reduced-motion`.
- Não esconder ações críticas apenas no hover.

## Critérios de aceite visual
- Agendamento, login e painel coerentes com a mesma paleta.
- Nenhuma funcionalidade anterior removida.
- Elementos interativos distinguíveis e operáveis por teclado.
- Sem sobreposição ou corte de conteúdo em mobile.
- Verificação real em navegador antes de considerar a entrega validada.
