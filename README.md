# BarberBook

Sistema web de agendamento e gerenciamento de barbearias, em reestruturação para **comercialização por implantação individual**. Cada cliente terá sua própria instalação e projeto Supabase.

> **Status:** em desenvolvimento. A versão atual não foi auditada integralmente para uso comercial. Não utilizar dados reais de clientes antes de revisar as políticas de acesso do Supabase.

## Funcionalidades existentes

- Seleção de serviços, data, horário e profissional.
- Agendamento com nome e WhatsApp.
- Login administrativo com Supabase Auth.
- Painel com indicadores de atendimentos e faturamento.
- Configuração de dias e horários disponíveis e bloqueio de datas.
- Listagem, pesquisa, edição e exclusão de agendamentos.
- Exportação de agendamentos em CSV.
- Layout responsivo com identidade visual **Azul Noturno**.

A disponibilidade e o comportamento de algumas funções dependem da estrutura efetiva e das permissões configuradas no projeto Supabase.

## Tecnologias atuais

HTML5, CSS3, JavaScript e Supabase (Auth e PostgreSQL). O fluxo de reserva mantém a seleção em memória. O banco é a fonte de autoridade para agendamentos e permissões.

## Estrutura

```text
index.html
css/
  style.css
  responsividade.css
  azul-noturno.css
js/
  config.js
  script.js
  agendamento.js
  admin.js
supabase-schema.sql
supabase/
  migrations/
  configuracao/
AGENTS.md
docs/
  ARCHITECTURE.md
  ROADMAP.md
  DESIGN_SYSTEM.md
  SUPABASE.md
```

## Executar localmente

1. Clone o repositório e abra-o no VS Code.
2. Sirva os arquivos por um servidor HTTP local (por exemplo, a extensão Live Server), em vez de abrir `index.html` diretamente pelo sistema de arquivos.
3. Configure o cliente para o Supabase local ao testar. Para cada instalação comercial, use o projeto próprio da barbearia e valide o fuso IANA e o catálogo público com o guia do Supabase.
4. Abra a URL local e verifique o fluxo público e o login administrativo.

**Importante:** a chave pública anon/publishable do Supabase não concede segurança por si só. É obrigatório validar RLS, grants, views e RPCs. Nunca inclua uma chave `service_role` ou credenciais privadas no frontend. Não há usuário/senha administrativo padrão garantido: os usuários devem ser provisionados pelo Supabase Auth conforme as permissões efetivas do banco.

## Schema do banco

As migrações em `supabase/migrations/` permitem recriar a estrutura para uma implantação vazia. O arquivo `supabase-schema.sql` é o ponto de entrada pelo `psql`. A configuração de uma barbearia e os dados fictícios de teste ficam em arquivos separados. Consulte [o guia de instalação e testes](docs/SUPABASE.md) para requisitos e pendências da integração.

## Desenvolvimento com Codex

Leia `AGENTS.md` antes de modificar arquivos. O plano de trabalho está em `docs/ROADMAP.md`; as diretrizes visuais estão em `docs/DESIGN_SYSTEM.md`.

O projeto continuará na branch `main`, com commits pequenos e revisão das alterações. A migração para React/TypeScript é uma possibilidade futura, **não uma decisão de implementação já aprovada**.

## Autor

Gabriel Puchinelli
