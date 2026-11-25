# Instalação, configuração das APIs e publicação

Este guia leva o app do zero até publicado na internet. Tempo estimado: 30–60 minutos.

## 1. Supabase (banco de dados e login)

1. Crie uma conta em <https://supabase.com> e um **novo projeto** (região sugerida: São Paulo).
2. Em **SQL Editor**, execute **na ordem** o conteúdo dos arquivos:
   1. `supabase/migrations/20261125000001_schema.sql`
   2. `supabase/migrations/20261125000002_seed_and_defaults.sql`
   3. `supabase/migrations/20261125000003_storage.sql`

   Alternativa com a CLI: `npx supabase link --project-ref SEU_REF` e `npx supabase db push`.
3. Em **Project Settings › API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (**nunca** coloque esta chave em código do navegador)
4. Em **Authentication › URL Configuration**:
   - *Site URL*: a URL do app (ex.: `https://vilma.vercel.app`)
   - *Redirect URLs*: `https://SEU-DOMINIO/auth/callback` e `http://localhost:3000/auth/callback`
5. (Opcional) **Login com Google**: *Authentication › Providers › Google*, informe Client ID/Secret de um OAuth Client do Google Cloud (tipo “Aplicativo da Web”) com o redirect `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
6. (Recomendado) **Authentication › Email Templates**: traduza os e-mails de confirmação e recuperação para português.
7. **Realtime**: a migration adiciona as tabelas principais à publicação `supabase_realtime` (sincronização entre dispositivos). Confira em *Database › Replication*.

## 2. Assistente Vilma (Anthropic)

1. Crie uma chave em <https://console.anthropic.com> (*API Keys*).
2. Configure `ANTHROPIC_API_KEY`. Opcional: `ANTHROPIC_MODEL` (padrão `claude-opus-5-5`).
3. Custos: cobrados por uso pela Anthropic. O app limita cada usuária a 40 mensagens/hora (ajustável em `src/app/api/vilma/route.ts`).

## 3. Google Agenda (sincronização)

1. No <https://console.cloud.google.com>: crie um projeto, ative a **Google Calendar API**.
2. *APIs e serviços › Tela de consentimento OAuth*: tipo Externo, adicione os escopos `.../auth/calendar.events` e `.../auth/calendar.readonly`. Enquanto estiver em “Teste”, cadastre os e-mails das testadoras.
3. *Credenciais › Criar ID do cliente OAuth* (Aplicativo da Web) com o URI de redirecionamento: `https://SEU-DOMINIO/api/google/callback` (e `http://localhost:3000/api/google/callback` para desenvolvimento).
4. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `INTEGRATIONS_ENCRYPTION_KEY` (`openssl rand -base64 32`) e `SUPABASE_SERVICE_ROLE_KEY`.
5. Para publicar para qualquer pessoa, o Google exige a verificação do app (escopos sensíveis).

## 4. Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha
npm run dev
```

## 5. Publicação na Vercel

1. Envie o repositório ao GitHub e importe em <https://vercel.com/new>.
2. Em *Settings › Environment Variables*, cadastre todas as variáveis do `.env.example` (com `NEXT_PUBLIC_SITE_URL` = URL final).
3. Gere `CRON_SECRET` (`openssl rand -hex 32`). O arquivo `vercel.json` agenda `/api/cron/automations` diariamente às 09:00 UTC (06:00 em Brasília); a Vercel envia o header `Authorization: Bearer CRON_SECRET` automaticamente.
4. Faça o deploy. Depois, atualize a *Site URL* e *Redirect URLs* no Supabase e o redirect do Google com o domínio final.
5. Domínio próprio: *Settings › Domains* na Vercel.

## 6. Checklist pós-publicação

- [ ] Cadastro, confirmação de e-mail e login funcionando
- [ ] `/configuracao` mostrando as variáveis como “configurada”
- [ ] Preencher controlador/encarregado (DPO) em `src/app/(public)/privacidade/page.tsx` e revisar os Termos com assessoria jurídica
- [ ] Testar a Vilma com uma mensagem simples
- [ ] Conectar o Google Agenda em Configurações › Integrações
- [ ] Instalar o app no celular (Compartilhar › Adicionar à Tela de Início no iPhone; menu › Instalar no Android)

## 7. Banco de testes local (desenvolvedores)

`npm run test:db` aplica as migrations num PostgreSQL local (com um *shim* que emula `auth.uid()` e papéis do Supabase) e roda os testes de RLS. `npm run test:e2e` sobe também um shim HTTP compatível com o Supabase (somente para testes) e executa o Playwright. Ver `docs/RELATORIO-DE-TESTES.md`.
