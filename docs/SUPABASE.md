# Schema e testes do Supabase

Cada barbearia usa um projeto Supabase próprio. As migrações em `supabase/migrations/` são a fonte de verdade. As três migrações iniciais partem de um projeto vazio. A atualização de uma instalação existente para intervalos requer o procedimento deste guia.

## Instalação inicial

1. Crie um projeto Supabase vazio e escolha o fuso IANA da barbearia. Mantenha `public` na Data API e `barberbook_private` fora dos schemas expostos. Desative grants automáticos para novos objetos, se essa opção estiver disponível no projeto, e confira os grants efetivos após aplicar as migrações.
2. Em banco vazio, aplique as migrações versionadas em ordem. Pelo `psql`, use `supabase-schema.sql`. Pelo fluxo do Supabase, use o diretório de migrações. Escolha um caminho. O executor precisa ser proprietário dos objetos criados, poder referenciar `auth.users(id)`, criar e conceder os papéis internos sem login e instalar `btree_gist`. A instalação completa nasce com criação pública apenas pela Edge Function. Para um banco em uso, aplique a migração de fechamento somente na janela de corte aprovada.
3. Revise e aplique manualmente `supabase/configuracao/instalacao.exemplo.sql`. Confirme o fuso, os preços, as durações de exemplo, as janelas semanais e os candidatos a início com a loja. Sincronize a configuração pública conforme a seção abaixo. Verifique a RPC de horários elegíveis antes de publicar a interface.
4. Crie as contas de equipe no Supabase Auth por um canal administrativo. Pela administração do banco, associe o UUID de cada conta em `barberbook_private.perfis`. Um administrador tem papel `admin` e `barbeiro_id` nulo. Para um barbeiro, crie primeiro o registro em `public.barbeiros` e informe seu ID no perfil com papel `barbeiro`. Configure a URL e a chave pública apenas na implantação correspondente. O cadastro público de contas é dispensável para o agendamento.
5. Verifique com dados fictícios o fluxo público e dois perfis de equipe. Confirme as três colunas da view, a ausência de PII para visitantes, o escopo de cada profissional e a proteção contra reservas simultâneas. Antes de promover a implantação, registre a versão do PostgreSQL, os arquivos aplicados e o procedimento de backup.

A configuração da loja é aplicada separadamente dos dados de teste. Nenhuma migração cria contas, profissionais ou reservas. Sem instalação e disponibilidade configuradas, a agenda pública fica sem opções e a criação de reserva é rejeitada.

## Atualizar uma instalação para intervalos

Em uma instalação com dados, faça backup verificável e ensaie a atualização em banco descartável com dados fictícios. As duas migrações devem ser aplicadas em momentos distintos. Suspenda escritas na janela de ativação. A criação do índice de exclusão bloqueia o acesso concorrente à tabela de agendamentos durante a migração. O limite de espera por locks é de cinco segundos. Meça o tempo de construção e planeje a janela para o volume da instalação.

1. Aplique somente `20261120000100_preparar_intervalos.sql`. Reservas continuam seguindo a regra anterior enquanto a configuração é preparada. A partir daqui, o fuso fica protegido se houver agendamentos.
2. Preencha `barberbook_private.servicos.duracao_minutos` para cada serviço com o valor aprovado pela loja. Valores válidos vão de 1 a 1.440 minutos. Configure `barberbook_private.janelas_expediente` com dia da semana, início e fim para cada trecho contínuo do expediente. As janelas de um mesmo dia podem ser adjacentes. Para permitir um atendimento atravessar o ponto de junção, cadastre uma única janela contínua.
3. Para cada reserva anterior, informe em `barberbook_private.referencias_intervalos_legados` o ID, a duração efetivamente contratada e uma referência operacional sem dados pessoais. Se um atendimento estiver comprovadamente concluído e sua duração for desconhecida, use `concluido_sem_duracao = true` com duração nula e registre a evidência. Uma reserva futura não pode ser classificada dessa forma. Preço, duração atual do catálogo e espaçamento entre inícios não comprovam a duração contratada.
4. Consulte `select * from barberbook_private.diagnostico_intervalos` como operador. A view identifica serviços sem duração, dias ativos sem janela, reservas sem referência, conclusões incompatíveis com o início, intervalos legados inválidos e pares sobrepostos. Resolva as pendências com a operação. O diagnóstico informa códigos e IDs, sem nome ou WhatsApp.
5. Aplique `20261120000200_ativar_intervalos.sql`. A migração repete o diagnóstico sob bloqueio e aborta a transação se houver pendências. O backfill usa apenas as referências fornecidas. As reservas existentes com intervalo conhecido preservam preço e ocupação, mesmo se o expediente configurado hoje for diferente. O histórico comprovadamente concluído e sem duração preserva o registro com campos de intervalo nulos e fica fora da exclusão GiST.
6. Aplique `20261120000300_horarios_elegiveis.sql` e confirme que a RPC está acessível pela Data API com a chave pública. Publique a interface da 6B na mesma janela da ativação dos intervalos. Clientes com a versão anterior em cache podem exibir horários que a escrita rejeitará. Oriente a recarregar a página e invalide o cache dos arquivos estáticos na publicação.

No histórico sem duração, a correção de contato continua disponível. Para mover o registro para uma nova data, é preciso selecionar outro serviço ativo, que fornecerá uma duração conhecida. Se a ativação abortar, mantenha a preparação aplicada, resolva as pendências e repita apenas a ativação. Se a ativação já tiver sido concluída e houver falha de publicação, suspenda novas reservas até restaurar a compatibilidade. Qualquer restauração de backup requer reconciliar as escritas posteriores ao backup.

## Sincronizar a configuração pública

Defina `FUSO_BARBEARIA` em `js/config.js` com o mesmo identificador IANA cadastrado em `barberbook_private.instalacao`. Em `index.html`, publique um cartão por serviço ativo, com o código exato em `data-servico` e o preço em BRL em `data-preco` e no texto visível. Os mesmos cartões alimentam as opções da edição administrativa. Em registros históricos, é possível manter o serviço registrado e seu preço original.

Antes de publicar, e sempre que alterar fuso ou catálogo, valide a correspondência com Node.js. No stack local, com o `psql` configurado para o banco local, execute a partir da raiz do repositório:

```sh
psql -X -Atq -v ON_ERROR_STOP=1 -c "
select jsonb_build_object(
  'fuso', i.fuso,
  'servicos', (select jsonb_agg(jsonb_build_object(
    'codigo', s.codigo,
    'preco', 'R$ ' || replace(s.preco::text, '.', ',')
  )) from barberbook_private.servicos s where s.ativo)
)
from barberbook_private.instalacao i;
" | node tests/database/verificar-configuracao.mjs
```

O verificador compara o fuso, os códigos ativos e os preços publicados. A exportação contém somente metadados públicos do catálogo e do fuso. Os clientes da Data API continuam sem acesso às tabelas privadas de configuração. O banco calcula o preço gravado na reserva a partir do catálogo ativo e mantém o preço histórico em alterações que preservam o serviço. A publicação do HTML e a atualização do catálogo precisam ser coordenadas pelo operador.

## Permissões e consistência

| Operação | Visitante | Autenticado sem perfil | Barbeiro ativo | Administrador ativo |
| --- | --- | --- | --- | --- |
| Ver profissionais ativos, dias, horários, bloqueios e ocupação pública | Sim | Sim | Sim | Sim |
| Criar reserva validada pela Edge Function após o corte | Sim | Sim | Sim | Sim |
| Inserir diretamente por REST ou GraphQL após o corte | Sem acesso | Sem acesso | Sem acesso | Sem acesso |
| Ler, editar e excluir registros privados | Sem acesso | Sem linhas | Apenas os próprios | Todos |
| Gerenciar dias, horários e bloqueios existentes | Sem acesso | Sem acesso | Sem acesso | Sim |
| Gerenciar catálogo, fuso, profissionais e vínculos de acesso pela API | Sem acesso | Sem acesso | Sem acesso | Sem acesso |

As três RPCs de perfil em `public` são `SECURITY INVOKER` e só têm execução concedida a `authenticated`. Os auxiliares em `barberbook_private` são `SECURITY DEFINER`, usam `auth.uid()` e devolvem apenas o papel ou o ID do próprio profissional. Eles pertencem ao executor confiável da migração para ler a associação privada e usar a função de identidade mantida pelo Supabase. O validador de reserva tem um proprietário separado, sem login e sem acesso aos registros privados de clientes. As funções têm `search_path` fixo e referências qualificadas. O schema interno só tem o acesso necessário para resolução e execução dos auxiliares autorizados.

A view `agendamentos_publicos` contém `data`, `horario` e `barbeiro_id`. Ela usa `security_barrier` e um proprietário sem login, sem `BYPASSRLS` e com acesso apenas às três colunas. Uma política RLS limita a leitura desse papel a hoje e aos seis dias seguintes no fuso da loja. Os papéis da API não podem assumir o proprietário da view. As migrações revogam privilégios padrão do executor e grants explícitos no escopo dos objetos do BarberBook.

O banco usa hora e data locais da loja para validar a criação, a remarcação e a troca de serviço. O início deve ser futuro, estar ativo em um dia ativo e fora de bloqueios. O serviço inteiro deve caber em uma janela contínua. As janelas podem criar pausas e têm seus limites convertidos para instantes no fuso IANA. Limites civis inexistentes ou ambíguos tornam a janela inelegível naquela data. O atendimento pode terminar à meia-noite exata por usar a faixa semiaberta `[início, fim)`. A ocupação do dia seguinte é rejeitada. A criação pública tem janela de sete dias. A remarcação da equipe pode ir além, seguindo as demais regras.

O intervalo gravado representa minutos decorridos a partir do início convertido para `timestamptz`. Só são aceitos inícios civis que correspondem a um único instante. No avanço do relógio, a conversão de ida e volta detecta o horário inexistente. No atraso, as duas ocorrências podem passar pela ida e volta, então a função também verifica se os deslocamentos do fuso em torno da transição produzem um segundo instante válido. A RPC e a gravação usam a mesma função e rejeitam horários repetidos. O diagnóstico de atualização sinaliza legados cujo início civil não pôde ser resolvido com segurança. A exclusão GiST rejeita sobreposição para o mesmo profissional, inclusive com inícios diferentes. Atendimentos consecutivos e profissionais distintos podem coexistir. A chave única anterior e o lock transacional em `READ COMMITTED` seguem ativos. As janelas participam do mesmo protocolo de escrita. Se a reserva vier primeiro, mudanças posteriores de expediente ou bloqueio a preservam. Se a mudança vier primeiro, a reserva é validada pelas novas regras.

## Compatibilidade com a interface e pendências

- A Edge Function envia ao banco o código do serviço, horário local, profissional e contato, com retorno mínimo. O banco grava o nome do profissional e o preço canônico. `preco` continua em texto BRL para os indicadores e o CSV.
- A Etapa 6B usa a RPC abaixo para listar horários. A interface trata `23P01` e `23505` como conflito de horário. Ambos exigem recarregar a disponibilidade e voltar a selecionar um horário. Em falha de rede com resultado indeterminado, a interface preserva os dados digitados e evita o reenvio automático.
- O WhatsApp é validado e gravado com 10 a 15 dígitos e sinal `+` opcional. A pesquisa aceita número formatado e o CSV usa a forma armazenada.
- A interface converte o instante do dispositivo para o fuso IANA da barbearia. A precisão do relógio do dispositivo e as versões da base de fusos ainda podem diferir do servidor. A instalação vazia permite definir ou corrigir o fuso. A preparação dos intervalos bloqueia a mudança do fuso e a remoção da configuração enquanto houver agendamentos, inclusive históricos. A configuração deve ser removida por `DELETE` quando a agenda estiver vazia. Uma futura mudança de fuso com reservas preservadas exigirá migração específica que trate horários civis, instantes e conflitos conjuntamente.
- Barbeiros têm acesso de leitura à disponibilidade e podem editar ou excluir seus próprios agendamentos. Escritas confirmam o retorno da linha afetada. Para sucesso HTTP com zero linhas, a interface informa que o registro está indisponível para a sessão. A RLS pode produzir a mesma resposta para um registro removido ou fora do escopo, e a recarga usa a listagem autorizada.
- A projeção privada lê `agendamentos.id` como texto pela Data API para preservar a precisão do `bigint` nos filtros de edição e exclusão. O ID do profissional continua sendo o UUID recebido das RPCs e da lista de profissionais.
- As listas de profissionais, dias e bloqueios e as consultas administrativas continuam paginadas por deslocamento, com ordenação estável e contagem exata. Uma falha pública detectada invalida a consulta inteira. Uma contagem constante não garante uma fotografia consistente entre páginas. A RPC de horários usa uma única consulta para uma data e permanece sujeita à validação transacional na gravação.
- Antes de liberar publicamente, valide o isolamento da escrita, ajuste as cotas de reserva e defina o tratamento dos CSVs exportados.

## Contrato público de horários da Etapa 6B

`public.horarios_elegiveis(p_servico text, p_barbeiro_id uuid, p_data date)` recebe o código do serviço, o UUID do profissional e uma data civil no fuso IANA da loja. A Data API entrega um objeto JSON escalar, por exemplo `{"total":2,"horarios":["09:00","09:30"]}`. A lista é ordenada e completa para aquela data, sem paginação de horários. Serviço ou profissional inativo, falta de horários e data fora da janela pública retornam `{"total":0,"horarios":[]}`.

A função reutiliza a conversão civil e o cálculo de intervalo usados na escrita. Seu proprietário sem login lê apenas colunas de ocupação dentro dos sete dias da RLS e os campos necessários da configuração. A resposta contém a contagem e os inícios elegíveis. A view de três colunas continua disponível para compatibilidade. A consulta orienta a escolha, e a restrição GiST e o trigger continuam decidindo se a reserva pode ser gravada sob concorrência.

## Preparação privada da Etapa 6C

`20261120000400_preparar_protecao_reservas.sql` cria o esquema `barberbook_reservas` e dois papéis inicialmente sem login. O esquema fica fora da Data API. Seu proprietário `barberbook_reservas_dono` tem acesso aos controles que possui e a `INSERT` nas colunas mínimas do agendamento. O papel `barberbook_edge_exec` só pode executar a admissão e a confirmação. A matriz de leitura e edição da equipe e o `INSERT` direto anterior continuam ativos. A ativação da proteção depende da publicação da função e do corte descritos abaixo.

### Contrato interno e limites

1. A Edge Function chama `admitir_tentativa(bytea)` em uma transação curta. Envia o HMAC de uma origem comprovada ou `NULL` quando não há origem verificável. O retorno é zero para admissão ou o número de segundos para tentar novamente. O débito global é revertido quando a cota por origem rejeita o pedido.
2. Após validar o desafio externamente, a Edge chama `confirmar_reserva` com resumos de 32 bytes para chave de idempotência, prova do conteúdo, token e contato. Use HMAC com separação de domínio e o mesmo WhatsApp normalizado para gerar a chave de contato de forma determinística. O proprietário da função insere na agenda pelo caminho normal, acionando os triggers e a exclusão GiST.
3. A resposta interna é um JSON com `resultado` e, quando limitado, `tentar_em`. A função retorna apenas estados operacionais. Não há busca pública por chave de idempotência. Uma nova tentativa precisa passar pela admissão e por uma nova validação externa. Mesmo com a mesma chave, a recuperação exige a prova e os mesmos campos. `confirmada`, `conflito` e `invalida` são repetíveis para o mesmo pedido durante 24 horas. Um pedido limitado permanece vinculado ao conteúdo e pode ser tentado de novo com outro desafio.

O operador ajusta a linha única em `barberbook_reservas.configuracao`. Os valores iniciais são 120 tentativas por minuto no total e 30 por origem confiável, com 60 reservas por hora no total e 3 por contato. São valores para calibração por instalação. As janelas são fixas, alinhadas ao relógio UTC do PostgreSQL. Podem ocorrer rajadas na fronteira entre janelas. A cota global funciona como proteção de emergência. A cota por origem só se aplica com origem verificada pela Edge Function, e a cota por contato se aplica a toda confirmação, inclusive sem IP confiável. O telefone informado não comprova titularidade, e clientes que compartilhem um contato compartilham sua cota.

A admissão confirmada permanece contabilizada se o provedor externo falhar. O token usado fica bloqueado por 15 minutos. A tentativa de gravação que retorna conflito ou invalidez conserva a marca do token e reverte a cota de reservas. Uma falha inesperada desfaz toda a transação de confirmação. A proteção do banco pressupõe que a Edge seguirá a ordem admissão, verificação externa e confirmação. O papel dedicado é uma fronteira de confiança.

### Configuração e rotação

- Provisionar a senha do papel `barberbook_edge_exec` por um canal administrativo seguro e habilitar `LOGIN`. O logging de DDL pode registrar tanto uma senha literal quanto o verificador enviado por `\password`. Antes do provisionamento, valide o procedimento com credenciais fictícias e confirme que a auditoria não registra a instrução ou seus valores. No ambiente local, use configurações de logging restritas à transação administrativa para omitir a instrução de senha. Não usar o proprietário das funções, um superusuário ou uma chave de serviço na conexão da aplicação. Não inserir senha em migrações ou arquivos versionados.
- Guardar a URL da conexão somente em um segredo do ambiente servidor. Em ambiente hospedado, testar pooler transacional, TLS e reconexão com o papel dedicado antes do corte. Usar parâmetros vinculados e desativar *prepared statements* persistentes ao usar o modo transacional. Validar a rotação em uma conexão nova, então trocar o segredo e reciclar conexões antigas. Em incidente, desabilitar o login e encerrar as sessões daquele papel. Rotação dos segredos HMAC é uma operação separada. Planejar compatibilidade com a janela de 24 horas da idempotência.
- Configurar uma rotina administrativa recorrente para `barberbook_reservas.limpar_expirados(1000)` e monitorar o volume e a duração da execução. A rotina remove registros expirados em lote e ignora linhas ocupadas. O papel da Edge não executa limpeza. Esta migração fornece a operação de limpeza. O agendamento fica a cargo da instalação.
- Usar `tests/edge/conexao-restrita/index.ts` apenas como sonda em stack local descartável. Copiar para a pasta de funções do stack de teste, definir `BARBERBOOK_EDGE_TEST_DSN` em arquivo temporário ignorado e invocar pelo gateway local. A sonda usa parâmetros vinculados, confirma o papel e verifica que a leitura de nome e WhatsApp falha. Seus resultados não incluem conexão, credenciais ou exceções brutas.
- Executar `python3 tests/database/protecao-reservas.py` após instalar as migrações em banco local vazio com prefixo `barberbook_test_`, Auth de teste provisionado e `PGHOST` em socket local ou loopback. O roteiro carrega dados fictícios e valida transações concorrentes, permissões, rollback, idempotência e limpeza.

## Edge Function e Turnstile da Etapa 6C

O frontend envia a reserva somente a `POST /functions/v1/criar-reserva`. O formulário carrega o widget na confirmação e usa a ação `criar_reserva`. Configure em `js/config.js` a `TURNSTILE_SITE_KEY` pública da instalação. Um valor vazio mantém a confirmação indisponível. O frontend usa a chave pública da Data API e preserva o nome e o WhatsApp somente no formulário. A função recebe `chave` (UUIDv4), `token`, `nome`, `whatsapp`, `servico`, `data`, `horario` e `barbeiro_id` em JSON.

Configure estes segredos no ambiente da função. Em desenvolvimento, use um arquivo temporário fora do repositório e um Supabase local descartável.

| Variável | Uso |
| --- | --- |
| `BARBERBOOK_EDGE_DSN` | URL PostgreSQL do papel `barberbook_edge_exec`. No pooler compartilhado, usar o nome de usuário com o sufixo de projeto fornecido na configuração do Supabase. Fornecer a URL sem parâmetros de consulta. A função desativa *prepared statements* persistentes e valida o certificado TLS. |
| `BARBERBOOK_POSTGRES_LOCAL` | `true` só no teste descartável. Permite desativar TLS nos endereços locais explicitamente aceitos. |
| `BARBERBOOK_TURNSTILE_SECRET` | Segredo do widget, separado da chave pública usada no HTML. O Siteverify é chamado exclusivamente pela função. |
| `BARBERBOOK_TURNSTILE_HOSTNAMES` | Hostnames autorizados pelo widget, separados por vírgulas. O valor é comparado ao retorno do Siteverify. |
| `BARBERBOOK_ORIGENS` | Origens web exatas, separadas por vírgulas. Use HTTPS no ambiente publicado. A lista controla CORS. |
| `BARBERBOOK_RESERVA_HMAC` | Segredo aleatório de pelo menos 32 caracteres para os resumos privados separados por domínio. |
| `BARBERBOOK_PROXY_HMAC` | Opcional. Segredo distinto para um proxy confiável. Sem ele ou sem prova válida, o limite global de admissão e o limite por contato continuam ativos. |

O endpoint é público por desenho e o JWT de usuário está desabilitado para ele em `supabase/config.toml`. Cada operação SQL valida `current_user` na transação. A função aceita apenas o papel dedicado e usa parâmetros vinculados. O timeout de cada comando SQL é de cinco segundos, e a verificação externa usa um prazo de 4,5 segundos. Respostas e logs da aplicação excluem dados de contato, token, conexão e diagnósticos brutos.

Os cabeçalhos comuns de IP são ignorados. Um proxy provisionado à parte pode assinar o corpo JSON bruto e os cabeçalhos `x-barberbook-origem` e `x-barberbook-tempo`. A assinatura, enviada como hex em `x-barberbook-assinatura`, é HMAC-SHA-256 de `JSON.stringify(["barberbook:proxy:v1", tempo, ip, corpo])`. O timestamp é Unix em segundos e tem tolerância de 30 segundos. O proxy deve sobrescrever esses cabeçalhos, assinar apenas o IP apurado na própria cadeia confiável e não devolver a assinatura ao cliente. A ausência de proxy autenticado mantém a admissão global. A identificação do contato na gravação independe do IP.

A resposta contém `resultado` e, quando limitado, `tentar_em` e o cabeçalho `Retry-After`. `201` confirma a operação. `409` sinaliza conflito ou incompatibilidade de idempotência. `400` cobre dados ou desafio inválidos. `422` exige revalidar disponibilidade ou serviço. `503` distingue provedor indisponível de resultado de gravação indeterminado. Após uma perda de resposta, a página mantém o contexto em memória, impede reenvio automático e pede um desafio novo para recuperar o mesmo pedido. Encerrar a tentativa requer confirmação explícita e orienta a consultar a barbearia.

### Corte do INSERT público por instalação

`20261120000500_fechar_insert_publico.sql` é uma migração separada. Revoga o `INSERT` na tabela e nas colunas para `anon`, `authenticated` e `PUBLIC`. Remove `criar_reserva_publica`, mantém `criar_reserva_interna` e pede atualização do cache de schema do PostgREST. A migração verifica grants efetivos, inclusive herdados, e aborta atomicamente se um papel da Data API ainda tiver acesso de criação na tabela, na view ou nas funções internas verificadas. Um grant herdado exige investigação e correção explícita pelo operador.

| Acesso | Antes da migração de corte | Depois da migração de corte |
| --- | --- | --- |
| Visitante `anon` e usuários `authenticated`, inclusive equipe | A Data API permite `INSERT` válido por coluna, sujeito ao trigger | `INSERT` na tabela e nas colunas revogado. A criação ocorre pela Edge Function |
| `PUBLIC` | Sem grant de escrita no schema versionado | Revogação explícita na tabela e nas colunas |
| `barberbook_edge_exec` | Executa admissão e confirmação privadas. Sem leitura ou inserção direta | Mesmo escopo |
| `barberbook_reservas_dono` | Inserção apenas nas colunas necessárias para a confirmação | Mesmo escopo |
| Barbeiro e administrador | Leitura, edição, exclusão e operações de disponibilidade conforme perfil | Mesmo escopo pela RLS |
| View pública e `horarios_elegiveis` | Apenas ocupação e horários elegíveis | Mesmo contrato, sem dados de contato |

**Preparação.** Obter aprovação de publicação, confirmar o backup e o caminho de recuperação, e conferir o histórico de migrações. Em instalação com dados, aplicar a preparação até `20261120000400` e manter o fechamento fora do lote automático até a janela aprovada. Auditar grants de papéis e colunas, políticas de inserção, funções com privilégios elevados, views graváveis e schemas expostos. Manter `barberbook_private` e `barberbook_reservas` fora da Data API. Repetir a verificação para extensões ou endpoints próprios da instalação.

**Validação hospedada pendente.** Provisionar `barberbook_edge_exec` via procedimento administrativo que preserve o segredo. Usar a URL do pooler em modo transacional, com o usuário dedicado no formato indicado pelo Supabase para aquele projeto e sem parâmetros de consulta na DSN. Manter `BARBERBOOK_POSTGRES_LOCAL` desativado. Confirmar TLS com validação do certificado e do hostname, a identidade efetiva durante a transação, o funcionamento com `prepare: false` e a rotação de segredo com conexões renovadas. Configurar o Turnstile real no hostname da loja, com `TURNSTILE_SITE_KEY` pública e segredo apenas no servidor. Validar `hostname`, ação `criar_reserva`, expiração e recuperação em smartphones físicos, incluindo navegadores internos. Conferir a auditoria de logs no ambiente hospedado. [Conexões PostgreSQL do Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres) · [Validação do Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

**Janela de mudança.** Disponibilizar primeiro a versão aprovada da função e verificar seu contrato. Preparar os estáticos com a função e a configuração pública da instalação. Durante a janela, suspender novas reservas se os passos não puderem ser sincronizados, aplicar o fechamento e ativar a interface protegida. Invalidar o cache dos arquivos estáticos. Confirmar que abas antigas com o caminho direto recebem negação. Se a migração abortar, corrigir a causa e repetir antes de anunciar o fechamento.

**Aceite do corte.** A Edge Function confirma uma reserva com um desafio legítimo. Reusar a mesma operação com novo desafio devolve o resultado original, sem segunda gravação. REST e tentativa de *upsert* recusam `anon` e JWTs da equipe ou de usuários sem perfil. A Data API recusa chamar as funções privadas. No GraphQL, quando habilitado, as mutações de inserção na agenda não aparecem e as tentativas são recusadas. Confirmar que a consulta pública mantém seu formato sem contatos e que barbeiro e administrador continuam restritos aos escopos anteriores. Registrar os resultados por instalação antes de reabrir o fluxo público.

**Rollback seguro.** Após o corte, manter a revogação. Restaurar somente uma versão da função e dos estáticos que use a rota protegida. Se isso não for possível, suspender a criação pública e manter consulta e painel. Ao restaurar backup de uma versão anterior ao corte, reaplicar e verificar a revogação antes de devolver acesso público. Reconciliar as reservas confirmadas após o backup.

**Risco de esgotamento da cota global.** Sem origem confiável, toda tentativa com formato válido disputa o mesmo orçamento antes do Turnstile. Tráfego abusivo pode esgotá-lo e causar `429` para clientes legítimos até a próxima janela. A cota por contato só atua na gravação e não resolve essa indisponibilidade. Antes de publicar, ensaiar a proteção sob carga, monitorar respostas `429` e preparar um canal de atendimento. Se a instalação exigir proteção contra esse cenário, validar um proxy autenticado com limite por origem ou limitação anterior à Edge Function. Aumentar a cota global aumenta a pressão sobre o banco e o provedor.

## Testes locais com dados fictícios

Os testes SQL usam `SET ROLE` para exercitar grants e RLS de verdade. Use exclusivamente um cluster ou projeto local descartável. O script `bootstrap-postgres.sql` cria papéis e uma superfície mínima de Auth para um PostgreSQL vazio. Ele é desnecessário no Supabase local, que já possui Auth. Testes nativos com esse bootstrap não validam emissão de JWT, autenticação e PostgREST do Supabase.

No PostgreSQL local vazio, use `psql` como operador da instância. Aplique `tests/database/bootstrap-postgres.sql` e `supabase-schema.sql`, depois execute `tests/database/corte-reservas.sql`, usando `psql -X -v ON_ERROR_STOP=1 -f`. O teste encerra com rollback. Rode `seguranca.sql`, `intervalos.sql` e `concorrencia.sh` em bancos separados migrados até `20261120000400`, pois esses roteiros exercitam o caminho legado. Rode `protecao-reservas.py` em um banco vazio já migrado até o corte para testar a concorrência pela operação privada.

Para concorrência, prepare outro banco vazio com nome começando por `barberbook_test_`, com o esquema Auth de teste e as mesmas migrações. Defina `PGDATABASE` e `PGHOST` para esse banco e execute `bash tests/database/concorrencia.sh`. O script aceita socket Unix ou loopback, verifica que duas conexões disputam o lock, testa os resultados e deixa os dados fictícios no banco descartável. Se repetir em um banco novo no mesmo cluster, reaproveite os papéis globais `anon`, `authenticated` e `service_role` no bootstrap.

Para o upgrade, prepare um terceiro banco local vazio com prefixo `barberbook_test_` e Auth de teste. Execute `bash tests/database/atualizacao-intervalos.sh` antes de aplicar qualquer migração a esse banco. O roteiro cria dados fictícios na versão antiga, verifica que a ativação aborta por evidência insuficiente e conflitos, e valida o backfill após a correção.

O aceite da integração Supabase inclui reaplicar as migrações no stack local, validar a configuração pública e rodar os testes de banco com Auth real. Sirva uma cópia do frontend com URL e chave pública do stack local, usando clientes, profissionais e contas fictícias. No navegador, valide a reserva pública, o login sem perfil, os escopos de barbeiro e administrador, a disponibilidade, os retornos de zero linhas, o CSV e o logout com requisição pendente. Valide também a falha de uma página intermediária e a recuperação sem reenvio automático. Mantenha esses resultados separados dos testes nativos de PostgreSQL e dos testes com mocks.

Para testar a virada pelo gateway, use um Supabase local descartável com as sete migrações de preparação e nenhuma configuração da loja. Sirva a Edge Function local com o papel dedicado e um Siteverify simulado **somente em uma cópia descartável da função**, sem registrar tokens. Rode `python3 tests/edge/corte-local.py /caminho/local/status.env`, com o arquivo de `supabase status --env` protegido. O teste cria contas e reservas fictícias, aplica o corte no próprio stack e compara REST, RPC, GraphQL quando disponível, permissões do painel e escrita pela Edge antes e depois. Para exigir a regressão com introspecção, habilite `pg_graphql` e a introspecção de `public` apenas no stack descartável, depois acrescente `--exigir-graphql`. Com introspecção desligada, o teste ainda tenta a mutação se a API GraphQL responder. [Configuração de introspecção do Supabase](https://supabase.com/docs/guides/graphql/configuration)

As regressões automatizadas do frontend podem ser executadas com `node --test tests/*.test.mjs`. O teste de listagem usa Chrome ou Chromium headless, com caminho configurável em `CHROME_BIN`.
