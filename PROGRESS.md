# PROGRESS — Vilma — Minha Vida

Arquivo de acompanhamento para retomar o projeto a qualquer momento.
Última atualização: 25/11/2026 · branch `claude/vilma-personal-organization-app-v9srli`

## Status por fase

| Fase | Status | Entregas |
|---|---|---|
| 1. Arquitetura e design system | ✅ | Next.js 15 + TS + Tailwind 4; tokens claro/escuro; componentes UI; paleta de gráficos validada; ícones PWA |
| 2. Banco, autenticação e onboarding | ✅ | 3 migrations (≈50 tabelas, RLS, gatilhos, funções, storage); login/cadastro/recuperação/Google; onboarding em 5 passos |
| 3. Dashboard e navegação | ✅ | Início com widgets personalizáveis, menu inferior (Início, Meu plano, Tracker, Bem-estar, Vilma) e menu lateral |
| 4. Agenda, tarefas e hábitos | ✅ | Agenda dia/semana/mês/ano, D&D, conflitos; tarefas lista/Kanban; hábitos e tracker |
| 5. Finanças | ✅ | Contas, cartões, faturas, parcelas, transferências, contas fixas/assinaturas, orçamentos, gráficos, CSV/PDF |
| 6. Sono, humor, ciclo, hidratação e treinos | ✅ | Todos os módulos + hub Bem-estar |
| 7. Trabalho, estudos, casa, anotações e metas | ✅ | Todos os módulos + modo foco |
| 8. Vilma (IA) | ✅ | Chat, voz, histórico, 25 ferramentas, confirmação de ações sensíveis |
| 9. Integrações e automações | ✅* | Google Agenda (OAuth + sync bidirecional), 12 automações + lembretes no horário, Vercel Cron, Web Push |
| 10. Gamificação e personalizações | ✅ | Pontos, níveis, medalhas, avatar, widgets, temas |
| 11. Segurança, testes e otimização | ✅ | 56 unitários, testes SQL de RLS, 24 E2E com RLS real, axe WCAG AA |
| 12. Publicação e documentação | ✅ | README, docs/, .env.example, vercel.json |

\* Implementado e compilado; depende de credenciais externas para teste real.

## Decisões técnicas

- Dados acessados do cliente via Supabase com **RLS**; servidor apenas para segredos (IA, Google, service_role, cron).
- Regras de negócio puras em `src/lib/domain` (datas com fuso explícito, dinheiro em centavos, finanças, recorrência, sono, hábitos, ciclo, NLP, pomodoro).
- Status “atrasada” é derivado (não armazenado).
- Telas internas renderizadas apenas no cliente (cache offline/relógio local) para evitar divergência de hidratação.
- Fila offline (outbox) com ids gerados no cliente + Realtime para sincronizar dispositivos.
- IA: Messages API com *tool use* manual (`claude-opus-5-5`, effort `medium`, fallback padrão de recusa), confirmação de exclusões/alterações em massa via `pending_actions`.
- Pontos nunca decrescem; sem punição por inatividade.
- Texto secundário usa Dusky Lilac escurecido (#6E5975) e cores semânticas ajustadas para contraste AA.
- Protótipo original preservado em `legacy/` (os módulos “Remédios” e “Devocional” dele podem ser adicionados como hábitos/anotações).

## Modo local (uso imediato)

Versão estática sem servidor (`npm run build:local`), publicada pelo workflow `pages-local.yml` na branch `gh-pages`. Endereço após ativar o Pages: https://almatti.github.io/ROTINA-PESSOAL/

## Pendências / próximos passos

1. Web Push ✅ implementado — falta configurar chaves VAPID e um agendamento a cada 15 min para lembretes no minuto exato.
2. Validar a Vilma com `ANTHROPIC_API_KEY` real (ajustar prompt/effort conforme uso).
3. Validar Google Agenda com credenciais reais e passar pela verificação do Google.
4. Preencher controlador/DPO na Política de Privacidade e revisar Termos juridicamente.
5. Traduzir templates de e-mail do Supabase.
6. Cobertura E2E para Storage (foto, anexos, vision board) e Realtime em ambiente Supabase real.
7. Migrar dados do modo local para a versão online (importar o JSON exportado).
8. Ideias: importação de extrato OFX/CSV, widgets de tela inicial nativos, remédios/devocional do protótipo.

## Atualização — Vilma gratuita

- Modo básico (regras + dados reais, sem IA) também na versão online, usado sem chave, por escolha da usuária ou quando a IA falha/estoura o limite.
- Provedor Gemini (plano gratuito) com as mesmas 25 ferramentas validadas; consentimento específico por provedor (`profiles.ai_consent_provider`, `consents.kind = 'ia_google'`).
- Pendente: cadastrar `GEMINI_API_KEY` na Vercel; testar contra a API real do Google.

## Resultados de testes (última execução)

- `tsc`: OK · `next build` (com lint): OK, 0 avisos
- `npm test`: 63/63 ✅ (inclui 6 testes do provedor Gemini)
- E2E modo local: 2/2 ✅
- `npm run test:db`: OK ✅
- `npm run test:e2e`: 24/24 ✅ (mobile Pixel 7 + desktop 1366px)

Detalhes: `docs/RELATORIO-DE-TESTES.md`.

## Como retomar

```bash
npm install
cp .env.example .env.local
npm run dev
# qualidade
npm run typecheck && npm test && npm run test:db && npm run test:e2e
```
