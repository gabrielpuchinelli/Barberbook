# Arquitetura — BarberBook

## Modelo comercial
Produto distribuído por **instalação individual por cliente**. A proposta é manter uma base de código versionada, com implantação e projeto Supabase separados para cada barbearia. Não há necessidade de `tenant_id` nesta etapa.

## Arquitetura observada no repositório
- `index.html`: página pública de serviços e agendamento, login e painel administrativo no mesmo documento.
- `css/style.css`: estilos legados; `css/responsividade.css`: ajustes responsivos; `css/azul-noturno.css`: nova camada visual.
- `js/config.js`: configuração pública do cliente Supabase e fuso IANA da instalação.
- `js/script.js`: fluxo de agendamento, persistência, autenticação, permissões, disponibilidade e painel.
- `js/agendamento.js` e `js/admin.js`: scripts adicionais de pequeno porte; verificar seus papéis antes de reorganizar.
- `supabase/migrations/`: fonte do schema reconstruído para um projeto vazio. `supabase-schema.sql` inclui as migrações pelo `psql`. O banco antigo foi excluído.
- O agendamento público mantém serviço, preço, profissional, data e horário em memória. O navegador descarta a seleção ao recarregar a página e remove as chaves legadas `agendamentos`, `barbeiro_nome`, `servico`, `preco`, `barbeiro_id`, `data` e `horario` do `localStorage` ao iniciar. Nome e WhatsApp ficam apenas no formulário até a confirmação.

## Recursos Supabase referenciados pelo frontend
- Tabelas: `agendamentos`, `barbeiros`, `dias_disponiveis`, `horarios_disponiveis`, `datas_bloqueadas`.
- View de compatibilidade: `agendamentos_publicos`.
- RPCs: `horarios_elegiveis`, `eh_admin`, `eh_barbeiro`, `barbeiro_atual_id`.
- Autenticação: Supabase Auth com login por e-mail e senha.

Os contratos acima estão definidos nas migrações. Configuração, matriz de permissões, regras de reserva e testes locais estão em [SUPABASE.md](SUPABASE.md).

## Separação dos dados no frontend

- A consulta pública pede à RPC os inícios elegíveis para um serviço, profissional e data. O banco calcula a duração e cruza o intervalo com a ocupação e o expediente. Nome e WhatsApp do cliente são enviados somente na criação da reserva. No painel, a consulta e a edição seguem o escopo do perfil.
- O fluxo público carrega em páginas os profissionais ativos, dias e bloqueios. A resposta de horários é escalar e está vinculada à seleção atual. Uma falha ou resposta incompleta impede a seleção e permite nova tentativa. A janela pública é recarregada quando muda o dia da barbearia.
- O agendamento usa o instante do dispositivo interpretado no fuso IANA da barbearia. Horários iniciados, passados ou inexistentes por mudança de fuso ficam indisponíveis. O envio revalida a seleção, e o banco confirma a disponibilidade.
- Voltar entre etapas mantém as escolhas válidas. Trocar serviço descarta profissional, data e horário. Trocar profissional descarta data e horário. Trocar data ou recarregar a disponibilidade descarta o horário. Uma falha no envio preserva os dados do formulário e exige nova seleção depois de recarregar a disponibilidade.
- O fluxo público permite um envio por vez e bloqueia mudanças de seleção e etapa durante a requisição. Em falha de rede com resultado indeterminado, avisa que a reserva pode ter sido registrada e recarrega a disponibilidade. Um novo envio exige ação explícita.
- O painel confirma a sessão antes de ativar a interface e antes de enviar cada escrita. A saída ou a troca de sessão limpa os dados e controles do painel, invalida o login pendente e cancela requisições no navegador. Respostas antigas são descartadas. Uma escrita já recebida pelo servidor pode ser concluída. Todas as páginas privadas de barbeiro usam o filtro obrigatório por ID.

## Painel administrativo

- Após o login, o painel abre na Agenda. A lista de hoje e os cinco próximos atendimentos usam os registros autorizados em memória e o dia e horário da barbearia. O painel recalcula essas listas na mudança de minuto e quando a janela ou aba volta a ficar ativa.
- O filtro por profissional aparece para administradores e atua sobre os registros já autorizados. Busca, data e profissional usam a mesma lógica nos cartões, na tabela e no CSV. O faturamento mantém o filtro por mês e o escopo de registros da sessão.
- O administrador pode alterar dias, horários e datas bloqueadas. O barbeiro consulta a disponibilidade geral e edita ou exclui seus próprios agendamentos. O painel confirma a linha retornada antes de atualizar o cache. Com zero linhas ou falha, preserva o formulário ou o último valor confirmado. A recarga consulta apenas a listagem autorizada.

## Pendências da integração Supabase

- Validar em smartphones físicos, incluindo os navegadores internos do WhatsApp e Instagram.
- Medir o custo da listagem completa e das contagens exatas para a capacidade de cada barbearia. A paginação ocorre em requisições separadas e está sujeita a alterações concorrentes do conjunto.

## Riscos técnicos conhecidos
1. Serviços e preços exibidos precisam ser sincronizados com o catálogo canônico na instalação e em atualizações. O procedimento de configuração inclui um verificador.
2. Um relógio incorreto no dispositivo pode afetar a apresentação. O banco valida com seu próprio relógio.
3. A consulta de horários reflete a disponibilidade no momento da leitura. Uma reserva concorrente pode invalidar um horário exibido antes do envio.

## Direção de evolução
- **Primeiro:** inventariar contratos do DOM, regras e schema; auditar acesso aos dados.
- **Depois:** separar funcionalidades em módulos JS mantendo compatibilidade e testes.
- **Interface:** fluxo de serviço → profissional → data/horário → confirmação, com estados claros.
- **Painel:** seções para visão geral, agenda, atendimentos, disponibilidade e configurações, preservando controles existentes.
- **Futuro opcional:** avaliar React + TypeScript apenas após decisão explícita e plano de migração.

## Critérios para uma implantação comercial
Permissões verificadas no banco real; ausência de acesso público a dados pessoais; prevenção de conflito de horários no servidor; autenticação validada; testes de fluxos críticos; configuração por barbearia; backup, documentação e procedimento de atualização.
