# Arquitetura e documentação técnica

## Visão geral

```
Navegador (PWA, React 19)
 ├─ Telas (Next.js App Router, client components)
 ├─ Camada de dados (src/lib/data): cache memória+localStorage, fila offline, realtime
 │     └─ supabase-js (chave anon) ──► PostgREST/Auth/Storage/Realtime do Supabase
 └─ Service worker (public/sw.js): shell offline, cache de assets, notificações
Servidor (Next.js route handlers, Node)
 ├─ /api/vilma            IA com ferramentas (sessão da usuária → RLS)
 ├─ /api/vilma/confirm    execução de ações sensíveis confirmadas
 ├─ /api/google/*         OAuth, sincronização, revogação (service_role + filtro user_id)
 ├─ /api/automations/run  automações da usuária (RLS)
 ├─ /api/cron/automations Vercel Cron (service_role + filtro user_id, CRON_SECRET)
 └─ /api/account/*        exportação (RLS) e exclusão (service_role)
Middleware: renovação de sessão e proteção das rotas autenticadas.
```

### Decisões principais

| Decisão | Motivo |
|---|---|
| Acesso a dados direto do cliente via Supabase + **RLS** | baixo custo, menos código de servidor, isolamento garantido pelo banco |
| Rotas de servidor só para segredos (IA, Google, service_role) | nenhuma chave privada no navegador |
| Regras de negócio em `src/lib/domain` puras e testadas | cálculos financeiros, datas, recorrências e sono verificáveis por unit tests |
| Datas de calendário como `YYYY-MM-DD` e instantes como `timestamptz` | evita erros de fuso; fuso configurável (padrão `America/Sao_Paulo`) |
| Dinheiro em centavos no cliente e `numeric(14,2)` no banco | sem erro de ponto flutuante |
| “Atrasada” derivada do prazo | sem jobs para atualizar status; sempre consistente |
| Telas internas renderizadas só no cliente | dados vêm do cache/offline e do relógio local — evita divergência de hidratação |
| IA com *tool use* manual (Messages API) e confirmação no servidor | a Vilma só altera dados por ferramentas validadas; exclusões/alterações em massa viram `pending_actions` |

## Design system

- Tokens em `src/app/globals.css` (`:root` e `[data-theme="dark"]`), mapeados para utilitários Tailwind 4 via `@theme inline` (`bg-surface`, `text-ink`, `text-muted`, `bg-primary-soft`, `rounded-card`, `shadow-soft`…).
- Paleta oficial: Midnight Orchid `#312A44`, Dusky Lilac `#88708E`, Iris Mist `#BAAAC8`, Plum Blossom `#D7C5D8`, Silver Wisteria `#DAD0E5`, roxo `#7451A6`, lavanda `#F7F4FB`. Para texto secundário usamos uma variação escurecida do Dusky Lilac (`#6E5975`) para atingir contraste WCAG AA; cores semânticas também foram ajustadas para ≥ 4,5:1.
- Paleta categórica de gráficos validada (separação para daltonismo, croma e luminosidade) em claro e escuro: `--chart-1..6`.
- Tipografia: Plus Jakarta Sans (interface) e Playfair Display (títulos editoriais).
- Componentes: `src/components/ui` (Button, Card, LinkCard, Chip, Badge, Field/Input/Select/Textarea, Toggle, Segmented, ProgressBar, Ring, Skeleton, EmptyState, Stat, Sheet/ConfirmDialog acessíveis, Toast), `src/components/charts.tsx`, `calendar-bits.tsx`.

## Modelo de dados

Migrations em `supabase/migrations`. Todas as tabelas pessoais têm `user_id uuid default auth.uid()` com `on delete cascade` e RLS (`user_id = auth.uid()` em select/insert/update/delete).

| Domínio | Tabelas |
|---|---|
| Usuária | `profiles` (preferências, metas, widgets, módulos, avatar, consentimentos), `consents` (histórico, sem update/delete) |
| Organização | `categories`, `tasks`, `subtasks`, `events`, `habits`, `habit_logs`, `focus_sessions`, `notifications` |
| Finanças | `financial_accounts`, `credit_cards`, `transactions`, `recurring_transactions`, `invoices`, `budgets` |
| Metas | `goals`, `goal_steps` |
| Bem-estar | `sleep_logs`, `mood_logs`, `cycle_periods`, `cycle_symptoms`, `water_logs`, `workout_plans`, `workout_exercises`, `workout_sessions`, `workout_sets` |
| Vida | `projects`, `project_stages`, `time_entries`, `courses`, `study_sessions`, `assessments`, `rooms`, `chores`, `shopping_lists`, `shopping_items`, `household_products`, `meals`, `maintenance_items`, `note_folders`, `notes`, `note_attachments` |
| IA | `conversations`, `messages`, `pending_actions` |
| Automação | `automations`, `automation_runs` |
| Gamificação | `achievements` (catálogo, leitura), `user_achievements`, `point_events` (escrita só via `award_points()`) |
| Integrações | `integrations` (tokens criptografados; colunas de token **não** legíveis pelo papel `authenticated`) |
| Segurança | `rate_limits` + função `consume_rate_limit()` |
| Push | `push_subscriptions` (endpoint https único, chaves do dispositivo) |

Gatilho `on_auth_user_created` cria perfil, automações e categorias padrão. Storage: bucket privado `user-files` com políticas por pasta `{user_id}/…`.

### Regras financeiras (src/lib/domain/finance.ts)

- **Transferência**: debita a origem e credita o destino; não é receita nem despesa.
- **Compra no cartão**: despesa na competência (data da compra) e entra na fatura do mês de referência (após o dia de fechamento → fatura seguinte); não sai de nenhuma conta na compra.
- **Pagamento de fatura**: sai da conta, mas **não** conta como despesa (evita duplicidade).
- **Parcelamento**: divisão exata em centavos (diferença na 1ª parcela), uma parcela por fatura consecutiva.
- **Saldo projetado** = saldo atual + a receber − a pagar − faturas em aberto.
- **Contas fixas/assinaturas** geram lançamentos “a pagar” idempotentes (índice único `recurring_id, occurred_on`); dia 31 vira o último dia de meses curtos.

## Camada de dados no cliente (offline e sincronização)

`src/lib/data/store.ts`:
- `useQuery(key, fetcher, { tables, table })`: cache em memória + `localStorage` (leitura offline), invalidação por tabela.
- `mutate(op)`: grava via supabase-js; sem rede, enfileira na *outbox* (localStorage) com ids gerados no cliente, aplica a alteração de forma otimista e sincroniza no evento `online`.
- `startSync`: inscrição Realtime filtrada por `user_id` para atualizar outros dispositivos.
- Erros do PostgREST traduzidos para mensagens amigáveis.

## Assistente Vilma

- `src/lib/vilma/tools.ts`: 25 ferramentas (panorama, tarefas, compromissos com conflitos, finanças, hábitos, sono, água, compras, notas, metas). Cada uma tem JSON Schema (para o modelo) e Zod (validação no servidor).
- `executeTool` valida → se a ferramenta é sensível (`delete_*`, `reschedule_tasks`), grava `pending_actions` e **não executa**. A interface mostra o cartão “Confirmar/Cancelar”; `/api/vilma/confirm` revalida e executa.
- Laço de *tool use* manual em `/api/vilma` (até 8 passos), prompt de sistema fixo com `cache_control`, contexto do dia em mensagem separada, `server-side fallback` padrão em recusas, tratamento de `refusal`, `pause_turn` e `max_tokens`.
- Privacidade: o diário (textos) e o ciclo menstrual nunca são lidos pelas ferramentas; requer consentimento (`profiles.ai_consent_at`); limite de 40 mensagens/hora.

## Google Agenda

`src/lib/google/calendar.ts`: OAuth com `state` em cookie httpOnly; tokens AES-256-GCM; sincronização bidirecional (janela −30/+180 dias, `updatedMin`, cancelados), *last-write-wins* por `updated` × `local_updated_at`, vínculo anti-duplicidade por título+início, exclusões locais propagadas (marcação `deleted_at`), recorrências convertidas para RRULE.

## Automações

`src/lib/automation/engine.ts` — funciona com cliente RLS ou service_role (sempre filtrando `user_id`). Notificações deduplicadas por `dedupe_key`. Nenhuma automação paga contas, exclui dados ou altera compromissos.

## Segurança

- RLS em todas as tabelas; testes automatizados de isolamento (SQL e E2E).
- Chaves privadas apenas no servidor; service_role usada só após validar a usuária e sempre com filtro por `user_id`.
- Cabeçalhos: `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`.
- Validação Zod no cliente e no servidor; *constraints* no banco (valores positivos, datas coerentes, enums).
- Rate limit no banco para IA, exportação, sincronização e automações.
- Redirecionamentos pós-login aceitam apenas caminhos internos.
- Cron protegido por `CRON_SECRET` com comparação em tempo constante.

## Web Push

`push_subscriptions` (RLS) guarda os dispositivos inscritos. `src/lib/push/client.ts` faz a inscrição (VAPID) e `/api/push/subscribe` registra; `src/lib/push/send.ts` envia com `web-push`, remove inscrições expiradas (404/410) e só aceita links internos no payload. O motor de automações envia push sempre que cria uma notificação nova (deduplicada), incluindo lembretes no horário exato de compromissos e tarefas (janela de 20 min, idempotente). O service worker trata o evento `push` e abre o link ao tocar.

## PWA

`src/app/manifest.ts`, ícones em `public/icons` (gerados por `npm run icons`), `public/sw.js` (navegação network-first com fallback offline, assets cache-first, nunca armazena `/api` nem respostas do Supabase), lembretes locais (`src/components/layout/reminders.tsx`).
