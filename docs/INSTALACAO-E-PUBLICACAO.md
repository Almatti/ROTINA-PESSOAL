# Instalação, configuração das APIs e publicação

Este guia leva o app do zero até publicado na internet. Tempo estimado: 30–60 minutos.

## 1. Supabase (banco de dados e login)

1. Crie uma conta em <https://supabase.com> e um **novo projeto** (região sugerida: São Paulo).
2. Em **SQL Editor**, execute **na ordem** o conteúdo dos arquivos:
   1. `supabase/migrations/20261125000001_schema.sql`
   2. `supabase/migrations/20261125000002_seed_and_defaults.sql`
   3. `supabase/migrations/20261125000003_storage.sql`
   4. `supabase/migrations/20261125000004_push_subscriptions.sql`

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

## 2. Assistente Vilma (três modos)

| Modo | Quando é usado | Custo |
|---|---|---|
| **Básico (sem IA)** | nenhuma chave configurada, ou a usuária escolheu “modo básico”, ou a IA ficou indisponível | grátis; nada sai do banco |
| **Gemini** | `GEMINI_API_KEY` configurada e sem chave da Anthropic | plano gratuito do Google (com limites diários; o Google pode usar o conteúdo para melhorar produtos) |
| **Claude (Anthropic)** | `ANTHROPIC_API_KEY` configurada (tem prioridade) | pago por uso |

**Gemini (grátis):** em <https://aistudio.google.com> › *Get API key* › *Create API key*; cadastre `GEMINI_API_KEY` na Vercel (Production) e publique de novo. Opcional: `GEMINI_MODEL` (padrão `gemini-flash-latest`). Quando o limite gratuito acaba, a Vilma responde no modo básico automaticamente.

**Anthropic:** crie uma chave em <https://console.anthropic.com> (*API Keys*) e configure `ANTHROPIC_API_KEY`. Opcional: `ANTHROPIC_MODEL` (padrão `claude-opus-5-5`).

O consentimento da usuária é pedido separadamente para cada provedor. O app limita cada usuária a 40 mensagens/hora com IA (ajustável em `src/app/api/vilma/route.ts`).

## 3. Google Agenda e Google Tasks

**O que vai para onde**
- **Google Agenda:** compromissos (trabalho, estudos, pessoal, casa), nos dois sentidos.
- **Google Tasks** (lista “Vilma”, criada automaticamente): tarefas de todas as áreas, hábitos do dia, provas/trabalhos de estudo, etapas de projeto, rotinas e manutenções da casa. Concluir no Google conclui no app; editar título/data de uma tarefa no Google altera no app; tarefa criada na lista “Vilma” entra no app; apagar no Google não apaga nada no app.
- **Alarmes:** a API do Google Tasks guarda só a data (sem horário). Itens com horário ganham um evento curto “⏰” no Google Agenda com aviso no minuto certo (desligável em Configurações). Esses alarmes não são importados de volta como compromissos.
- **Quando sincroniza:** alguns segundos depois de cada alteração no app, ao abrir o app (se passou mais de 10 min), no botão “Sincronizar agora” e no cron diário (06:00 em Brasília), que também cria os hábitos do dia.

**Configuração (Google Cloud)**
1. No <https://console.cloud.google.com>: crie um projeto e ative **Google Calendar API** e **Google Tasks API** (*APIs e serviços › Biblioteca*).
2. *Tela de consentimento OAuth*: tipo **Externo**; escopos `.../auth/calendar.events`, `.../auth/calendar.readonly` e `.../auth/tasks`.
3. **Publique o app** (*Publicar app* / “Em produção”). Em modo “Teste”, o Google expira o acesso a cada 7 dias. Sem a verificação do Google, aparece o aviso “O Google não verificou este app” ao conectar — para uso pessoal, toque em *Avançado › Acessar*. A verificação só é necessária para abrir o app ao público.
4. *Credenciais › Criar ID do cliente OAuth* (Aplicativo da Web) com o URI de redirecionamento `https://SEU-DOMINIO/api/google/callback` (e `http://localhost:3000/api/google/callback` para desenvolvimento).
5. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `INTEGRATIONS_ENCRYPTION_KEY` (`openssl rand -base64 32`) e `SUPABASE_SERVICE_ROLE_KEY`.
6. Aplique a migration `20261125000007_google_tasks.sql`. Quem conectou antes desta versão precisa reconectar para autorizar o Tasks (o app avisa).

## 4. Notificações com o app fechado (Web Push)

1. Gere as chaves: `npx web-push generate-vapid-keys`.
2. Configure `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (pública), `VAPID_PRIVATE_KEY` (somente servidor) e `VAPID_SUBJECT` (ex.: `mailto:contato@seudominio.com.br`).
3. Aplique a migration `20261125000004_push_subscriptions.sql`.
4. Cada usuária ativa em **Configurações › Notificações › Receber com o app fechado** (no iPhone, é preciso instalar o app na Tela de Início, iOS 16.4+).
5. **Frequência:** o `vercel.json` agenda as automações 1x por dia (limite do plano Hobby da Vercel). Para lembretes no horário exato (“30 min antes”), agende `GET /api/cron/automations` a cada 15 minutos — no plano Pro da Vercel (troque o `schedule` para `*/15 * * * *`) ou num agendador externo (ex.: cron-job.org, GitHub Actions) enviando o header `Authorization: Bearer SEU_CRON_SECRET`. O motor é idempotente: rodar várias vezes não duplica avisos nem lançamentos.

## 5. Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha
npm run dev
```

## 6. Publicação na Vercel

1. Envie o repositório ao GitHub e importe em <https://vercel.com/new>.
2. Em *Settings › Environment Variables*, cadastre todas as variáveis do `.env.example` (com `NEXT_PUBLIC_SITE_URL` = URL final).
3. Gere `CRON_SECRET` (`openssl rand -hex 32`). O arquivo `vercel.json` agenda `/api/cron/automations` diariamente às 09:00 UTC (06:00 em Brasília); a Vercel envia o header `Authorization: Bearer CRON_SECRET` automaticamente.
4. Faça o deploy. Depois, atualize a *Site URL* e *Redirect URLs* no Supabase e o redirect do Google com o domínio final.
5. Domínio próprio: *Settings › Domains* na Vercel.

## 7. Checklist pós-publicação

- [ ] Cadastro, confirmação de e-mail e login funcionando
- [ ] `/configuracao` mostrando as variáveis como “configurada”
- [ ] Preencher controlador/encarregado (DPO) em `src/app/(public)/privacidade/page.tsx` e revisar os Termos com assessoria jurídica
- [ ] Testar a Vilma com uma mensagem simples
- [ ] Conectar o Google Agenda em Configurações › Integrações
- [ ] Ativar o push num celular e tocar em “Enviar notificação de teste”
- [ ] Instalar o app no celular (Compartilhar › Adicionar à Tela de Início no iPhone; menu › Instalar no Android)

## 8. Banco de testes local (desenvolvedores)

`npm run test:db` aplica as migrations num PostgreSQL local (com um *shim* que emula `auth.uid()` e papéis do Supabase) e roda os testes de RLS. `npm run test:e2e` sobe também um shim HTTP compatível com o Supabase (somente para testes) e executa o Playwright. Ver `docs/RELATORIO-DE-TESTES.md`.
