# Schema e testes do Supabase

Cada barbearia usa um projeto Supabase próprio. As migrações em `supabase/migrations/` são a fonte de verdade e pressupõem um projeto vazio. O banco anterior foi excluído. A reconstrução usa os contratos do frontend versionado.

## Instalação inicial

1. Crie um projeto Supabase vazio e escolha o fuso IANA da barbearia. Mantenha `public` na Data API e `barberbook_private` fora dos schemas expostos. Desative grants automáticos para novos objetos, se essa opção estiver disponível no projeto, e confira os grants efetivos após aplicar as migrações.
2. Aplique os três arquivos de migração em ordem. Pelo `psql`, `supabase-schema.sql` inclui os arquivos na ordem correta. Pelo fluxo de migrações do Supabase, aplique diretamente o diretório versionado. Escolha um caminho para a instalação. O executor precisa ser proprietário dos objetos criados, poder referenciar `auth.users(id)` e poder criar e conceder os dois papéis internos sem login. O arquivo de entrada usa diretivas do `psql`.
3. Revise e aplique manualmente `supabase/configuracao/instalacao.exemplo.sql` como configuração da loja. Ele inclui fuso, catálogo e horários de exemplo. Ajuste dias e horários antes de abrir a agenda. Os códigos do catálogo precisam coincidir com `data-servico` em `index.html`. Mantenha também os preços visíveis alinhados ao catálogo enquanto o HTML for a fonte da apresentação.
4. Crie as contas de equipe no Supabase Auth por um canal administrativo. Pela administração do banco, associe o UUID de cada conta em `barberbook_private.perfis`. Um administrador tem papel `admin` e `barbeiro_id` nulo. Para um barbeiro, crie primeiro o registro em `public.barbeiros` e informe seu ID no perfil com papel `barbeiro`. Configure a URL e a chave pública apenas na implantação correspondente. O cadastro público de contas é dispensável para o agendamento.
5. Verifique com dados fictícios o fluxo público e dois perfis de equipe. Confirme as três colunas da view, a ausência de PII para visitantes, o escopo de cada profissional e a proteção contra reservas simultâneas. Antes de promover a implantação, registre a versão do PostgreSQL, os arquivos aplicados e o procedimento de backup.

A configuração da loja é aplicada separadamente dos dados de teste. Nenhuma migração cria contas, profissionais ou reservas. Sem instalação e disponibilidade configuradas, a agenda pública fica sem opções e a criação de reserva é rejeitada.

## Permissões e consistência

| Operação | Visitante | Autenticado sem perfil | Barbeiro ativo | Administrador ativo |
| --- | --- | --- | --- | --- |
| Ver profissionais ativos, dias, horários, bloqueios e ocupação pública | Sim | Sim | Sim | Sim |
| Criar reserva pública validada sem retorno do registro | Sim | Sim | Sim | Sim |
| Ler, editar e excluir registros privados | Sem acesso | Sem linhas | Apenas os próprios | Todos |
| Gerenciar dias, horários e bloqueios existentes | Sem acesso | Sem acesso | Sem acesso | Sim |
| Gerenciar catálogo, fuso, profissionais e vínculos de acesso pela API | Sem acesso | Sem acesso | Sem acesso | Sem acesso |

As três RPCs em `public` são `SECURITY INVOKER` e só têm execução concedida a `authenticated`. Os auxiliares em `barberbook_private` são `SECURITY DEFINER`, usam `auth.uid()` e devolvem apenas o papel ou o ID do próprio profissional. Eles pertencem ao executor confiável da migração para ler a associação privada e usar a função de identidade mantida pelo Supabase. O validador de reserva tem um proprietário separado, sem login e sem acesso aos registros privados de clientes. As funções têm `search_path` fixo e referências qualificadas. O schema interno só tem o acesso necessário para resolução e execução dos auxiliares autorizados.

A view `agendamentos_publicos` contém `data`, `horario` e `barbeiro_id`. Ela usa `security_barrier` e um proprietário sem login, sem `BYPASSRLS` e com acesso apenas às três colunas. Uma política RLS limita a leitura desse papel a hoje e aos seis dias seguintes no fuso da loja. Os papéis da API não podem assumir o proprietário da view. As migrações revogam privilégios padrão do executor e grants explícitos no escopo dos objetos do BarberBook.

O banco usa hora e data locais da loja para validar a reserva. Na inserção ou remarcação, o horário precisa ser futuro, compatível com os dias e horários ativos e fora de datas bloqueadas. A criação pública tem janela de sete dias. A remarcação pela equipe pode ir além dessa janela, seguindo as demais regras. Agendamentos existentes permanecem quando um dia ou horário é desativado. Uma alteração de contato em um histórico não revalida o horário.

A chave única contém profissional, data e horário. Escritas que afetam a agenda usam um lock transacional compartilhado pelo protocolo de escrita, com isolamento `READ COMMITTED` e validação após a espera. Se a reserva vier primeiro, o bloqueio posterior preserva essa reserva. Se o bloqueio vier primeiro, a reserva posterior é rejeitada. O desenho representa um slot por hora local e profissional, sem controle de duração ou sobreposição entre serviços. Horários inexistentes por transição civil de fuso são rejeitados. Uma hora local repetida continua representando um único slot.

## Compatibilidade com a interface e pendências

- O insert público conserva o payload atual. O banco grava nome do profissional e preço a partir dos cadastros canônicos. `preco` continua texto em BRL para os indicadores e o CSV. Ao trocar o serviço na edição, o valor canônico do novo serviço é gravado. Ao manter o mesmo serviço, a edição preserva o preço do registro. O campo livre atual pode enviar um código inexistente ou inativo e receber o erro genérico da tela.
- O WhatsApp é validado e gravado com 10 a 15 dígitos e sinal `+` opcional. Formatação enviada pelo navegador é removida. Busca e CSV passam a usar a forma armazenada.
- A tela pública ainda calcula datas e horários usando o relógio do navegador. Um dispositivo em outro fuso pode mostrar uma opção que o banco rejeitará. Trocar o fuso de uma loja com reservas existentes muda a interpretação futura dos horários locais. Defina o fuso antes do uso e trate alterações posteriores como uma operação de manutenção.
- O painel oferece controles de disponibilidade aos dois perfis. O banco concede a escrita da configuração geral só ao administrador. Uma edição sem autorização pode vir como zero linhas afetadas. O frontend atual não verifica a contagem de remoções, portanto pode informar sucesso na interface quando a exclusão foi barrada por RLS. O ajuste da interface precisa de aprovação separada.
- O frontend ainda não pagina a ocupação pública nem o histórico. Teste o limite de linhas da Data API com a capacidade da loja antes de liberar a instalação. A restrição do banco continua garantindo exclusividade mesmo se a tela estiver incompleta.
- RLS não oferece controle de abuso da criação pública. Antes de liberar publicamente, defina a estratégia de limitação de reservas abusivas e de tratamento dos CSVs exportados.

## Testes locais com dados fictícios

Os testes SQL usam `SET ROLE` para exercitar grants e RLS de verdade. Use exclusivamente um cluster ou projeto local descartável. O script `bootstrap-postgres.sql` cria papéis e uma superfície mínima de Auth para um PostgreSQL vazio. Ele é desnecessário no Supabase local, que já possui Auth. Testes nativos com esse bootstrap não validam emissão de JWT, autenticação e PostgREST do Supabase.

No PostgreSQL local vazio, use `psql` como operador da instância. Em uma primeira execução, aplique `tests/database/bootstrap-postgres.sql`, depois `supabase-schema.sql` e por último `tests/database/seguranca.sql`, usando `psql -X -v ON_ERROR_STOP=1 -f` para cada arquivo. A matriz encerra com rollback.

Para concorrência, prepare outro banco vazio com nome começando por `barberbook_test_`, com o esquema Auth de teste e as mesmas migrações. Defina `PGDATABASE` e `PGHOST` para esse banco e execute `bash tests/database/concorrencia.sh`. O script aceita socket Unix ou loopback, verifica que duas conexões disputam o lock, testa os resultados e deixa os dados fictícios no banco descartável. Se repetir em um banco novo no mesmo cluster, reaproveite os papéis globais `anon`, `authenticated` e `service_role` no bootstrap.

O aceite da integração Supabase inclui reaplicar as migrações no stack local, rodar os testes de banco com Auth real e validar as consultas atuais do navegador pela Data API. Mantenha esses resultados separados dos testes nativos de PostgreSQL e dos testes de interface com mocks.
