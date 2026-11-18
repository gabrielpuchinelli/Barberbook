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
- O agendamento público mantém serviço, preço, profissional, data e horário em memória. O navegador descarta a seleção ao recarregar a página e remove as chaves legadas `agendamentos`, `barbeiro_nome`, `servico`, `preco`, `barbeiro_id`, `data` e `horario` do `localStorage` ao iniciar. Nome e WhatsApp ficam apenas no formulário até a confirmação.

## Recursos Supabase referenciados pelo frontend
- Tabelas: `agendamentos`, `barbeiros`, `dias_disponiveis`, `horarios_disponiveis`, `datas_bloqueadas`.
- View: `agendamentos_publicos`.
- RPCs: `eh_admin`, `eh_barbeiro`, `barbeiro_atual_id`.
- Autenticação: Supabase Auth com login por e-mail e senha.

**Atenção:** nem todos esses recursos estão definidos em `supabase-schema.sql`. É necessário obter o schema efetivo, as grants, políticas RLS e definições de views/funções do projeto Supabase antes de qualquer migração.

## Separação dos dados no frontend

- O cálculo de ocupação compara `data`, `horario` e `barbeiro_id`. Esses são os únicos campos solicitados de `agendamentos_publicos`. No fluxo público, nome e WhatsApp do cliente são enviados na criação da reserva. No painel, esses dados continuam disponíveis para consulta e edição conforme o perfil.
- O fluxo público carrega a ocupação, os profissionais ativos e a configuração da agenda do Supabase. Se qualquer consulta falhar, as opções ficam indisponíveis e a interface permite tentar novamente. Uma configuração vazia não é substituída por dias e horários padrão.
- O agendamento compara a data e a hora do atendimento com o relógio local do navegador. Horários iniciados ou passados ficam indisponíveis na listagem e a regra é verificada novamente antes do envio.
- Voltar entre etapas mantém as escolhas válidas. Trocar serviço descarta profissional, data e horário. Trocar profissional descarta data e horário. Trocar data ou recarregar a disponibilidade descarta o horário. Uma falha no envio preserva os dados do formulário e exige nova seleção depois de recarregar a disponibilidade.
- O fluxo público permite um envio por vez e bloqueia mudanças de seleção e etapa durante a requisição. A trava é local à tela. As regras do servidor determinam conflitos entre abas e dispositivos.
- O painel confirma a sessão antes de ativar a interface e antes de enviar cada escrita. A saída ou a troca de sessão limpa os dados e controles do painel, invalida o login pendente e cancela as requisições de escrita no navegador. Respostas antigas são descartadas. Uma escrita já recebida pelo servidor pode ser concluída. A consulta de barbeiro usa filtro obrigatório por ID, com validação de inteiros positivos e UUIDs.

## Painel administrativo

- Após o login, o painel abre na Agenda. A lista de hoje e os cinco próximos atendimentos usam os registros autorizados em memória e o relógio local do navegador. O painel recalcula essas listas na mudança de minuto e quando a janela ou aba volta a ficar ativa.
- O filtro por profissional aparece para administradores e atua sobre os registros já autorizados. Busca, data e profissional usam a mesma lógica nos cartões, na tabela e no CSV. O faturamento mantém o filtro por mês e o escopo de registros da sessão.
- Os controles existentes de dias, horários e datas bloqueadas continuam usando a configuração geral da agenda. Escritas pendentes bloqueiam novas operações sobre o mesmo item na sessão. Em caso de falha, o painel mantém os dados digitados ou restaura o controle ao último valor confirmado.

## Pendências da auditoria do Supabase

- Confirmar que a view implantada fornece `data`, `horario` e `barbeiro_id` e verificar quais outras colunas e linhas os papéis públicos podem acessar. A seleção de colunas no frontend não altera a exposição da view pelo banco. Se faltar algum dos três campos, a disponibilidade fica indisponível até a regularização do contrato.
- Verificar grants, RLS, a definição da view e das RPCs, o tipo retornado por `barbeiro_atual_id` e o tratamento de reservas antigas sem profissional. Validar leitura pública mínima, criação pública e acesso privado com contas de administrador e barbeiro.
- Confirmar o tipo de `agendamentos.id` e sua representação nas respostas da API implantada. O SQL versionado declara `bigint generated by default as identity`. Edição e exclusão usam o ID recebido da API, sem converter o valor do DOM para número.
- Confirmar o limite de linhas efetivo da API para a consulta de ocupação e testar concorrência no servidor para o mesmo horário com profissionais iguais e distintos. Qualquer alteração de schema ou permissões depende de inventário do ambiente, backup e aprovação.

## Riscos técnicos conhecidos
1. O SQL versionado contém políticas que permitem operações de escrita para `anon` em tabelas sensíveis. Verificar se essas políticas estão efetivamente implantadas e corrigi-las de forma segura.
2. A restrição `unique(data, horario)` do SQL versionado não considera o profissional; pode bloquear agendamentos simultâneos de barbeiros distintos.
3. Serviços, preços e informações da barbearia estão codificados no HTML; deverão migrar para configuração por implantação.
4. O arquivo `js/script.js` concentra muitas responsabilidades.
5. A view pública e suas permissões precisam limitar o acesso aos dados indispensáveis para ocupação.
6. A duração dos serviços ainda precisa ser considerada no modelo de conflitos.

## Direção de evolução
- **Primeiro:** inventariar contratos do DOM, regras e schema; auditar acesso aos dados.
- **Depois:** separar funcionalidades em módulos JS mantendo compatibilidade e testes.
- **Interface:** fluxo de serviço → profissional → data/horário → confirmação, com estados claros.
- **Painel:** seções para visão geral, agenda, atendimentos, disponibilidade e configurações, preservando controles existentes.
- **Futuro opcional:** avaliar React + TypeScript apenas após decisão explícita e plano de migração.

## Critérios para uma implantação comercial
Permissões verificadas no banco real; ausência de acesso público a dados pessoais; prevenção de conflito de horários no servidor; autenticação validada; testes de fluxos críticos; configuração por barbearia; backup, documentação e procedimento de atualização.
