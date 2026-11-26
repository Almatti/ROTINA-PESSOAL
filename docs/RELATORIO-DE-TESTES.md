# Relatório de testes

Execução em 25/11/2026, num container Linux (Node 22, PostgreSQL 16.15, Chromium do Playwright 1.63). **Todos os resultados abaixo foram efetivamente executados.**

## Resumo

| Suíte | Ferramenta | Resultado |
|---|---|---|
| TypeScript (`tsc --noEmit`) | TypeScript 5.9 | ✅ sem erros |
| Lint (`next build`) | ESLint + next/core-web-vitals | ✅ 0 erros, 0 avisos |
| Build de produção | Next.js 15.5 | ✅ todas as páginas e APIs compiladas |
| Unitários | Vitest 3.2 | ✅ **80/80** |
| Banco de dados (migrations + RLS) | PostgreSQL 16 + psql | ✅ 13 grupos de asserções |
| End-to-end | Playwright 1.63 (Pixel 7 e desktop 1366px) | ✅ **25/25** (+1 suíte de capturas sob demanda)
| End-to-end da versão local (site estático em subpasta) | Playwright | ✅ **2/2** | |

## Testes unitários (`npm test`) — 57

- **Datas e fuso** (6): data local em São Paulo × UTC perto da meia-noite, conversão local→UTC (inclusive com horário de verão em Lisboa), aritmética de datas (fim de mês, ano bissexto), formatos DD/MM/AAAA, saudação por horário, rótulos de duração.
- **Dinheiro** (4): interpretação de “R$ 1.234,56”, “3 mil”, “84,90”; formatação BRL; ausência de erro de ponto flutuante; parcelas que somam exatamente o total.
- **Finanças** (10): transferência não é receita/despesa; pagamento de fatura não duplica despesa; fatura após fechamento; parcelamento em faturas consecutivas; limite disponível; saldo projetado; gastos por categoria e orçamento; contas a vencer/atrasadas; contas fixas com dia 31; série mensal.
- **Recorrência** (5): diária com intervalo, semanal por dias, mensal com dia 31, `until`/`count`, próxima ocorrência anual a partir de 29/02.
- **Bem-estar** (8): sono atravessando a meia-noite, estatísticas e dívida de sono, previsão de ciclo (com e sem histórico), sequências de hábitos (sem punir o dia corrente), dias específicos, metas quantitativas, “x vezes por semana”.
- **Tarefas, conflitos, gamificação, pomodoro** (8): status atrasada derivado, ordenação, indicadores, sugestão de reagendamento, sobreposição de horários, níveis, cronômetro baseado em timestamps (consistente ao navegar), ciclo foco/pausas.
- **Linguagem natural** (4): inclui valores sem “R$” após verbos de dinheiro (“gastei 45,90 no mercado”) sem confundir com datas (“dia 10”);: “amanhã”, “sexta”, “dia 10”, “15/01”, “daqui a 3 dias”, “às 7h”, “19h30”, “3 da tarde” e comandos completos (agendar, despesa, receita, lembrete, sono, água).
- **Web Push** (3): payload com tamanho limitado e somente links internos; envio por dispositivo com remoção de inscrições expiradas (410); nada é enviado sem chaves VAPID.
- **Google Tasks** (13): o que vai para o Google (tarefas de todas as áreas, hábitos só no dia agendado, provas, etapas, rotinas, manutenções), alarmes só para itens com horário, e sincronização completa contra um Google simulado: criação da lista “Vilma”, envio sem duplicar (2ª execução sem escritas), conclusão no Google → app (tarefa, hábito, rotina com próxima data), conclusão no app → Google com remoção do alarme, tarefa criada no Google entra no app, edição de título/data, exclusão nos dois sentidos, reconexão sem permissão do Tasks e alarmes desligados.
- **Gemini** (10): inclui troca para o modelo reserva quando o Google está sobrecarregado (503), nova tentativa sem `thinkingLevel`, limite de tempo para nunca deixar a tela carregando e sobrecarga persistente tratada; conversão das 25 ferramentas para o formato do Gemini; laço de ferramentas com assinatura de raciocínio preservada e id da chamada; limite gratuito (429) tratável; bloqueio de segurança como recusa; papéis do histórico.
- **Ferramentas da Vilma** (9): esquemas válidos; parâmetros inválidos rejeitados antes do banco; ferramenta desconhecida bloqueada; **exclusão gera ação pendente e não executa**; execução só após confirmação; alteração em massa exige confirmação; sem conta cadastrada não inventa saldo; valor decimal exato; sono por duração.

## Banco de dados (`npm run test:db`)

Aplica as 3 migrations sobre um shim do Supabase (`auth.uid()`, papéis `anon`/`authenticated`/`service_role`, storage) e verifica:

1. Gatilho de nova conta cria perfil, 12 automações e 27 categorias padrão.
2. `user_id` preenchido automaticamente por `auth.uid()`.
3. **Usuária B não lê, não altera e não apaga** tarefas, notas, contas e dados de ciclo da usuária A.
4. Inserir registro com `user_id` alheio é bloqueado (RLS).
5. Restrições: valor negativo, transferência sem contas e sono com acordar antes de dormir são rejeitados; precisão decimal (0,10 + 0,20 = 0,30).
6. Tokens de integração não são legíveis pela usuária; revogação (delete) permitida.
7. Pontos só via `award_points()`, com deduplicação; escrita direta bloqueada.
8. Rate limit bloqueia acima do limite.
9. Upload em pasta de outra usuária no Storage é bloqueado.
10. Inscrições de push: somente da própria usuária e apenas endpoints https.
11. Papel anônimo não lê dados.
12. Exclusão da conta remove todos os dados em cascata.

## End-to-end (`npm run test:e2e`) — 24

Ambiente: build de produção do app + PostgreSQL real com as migrations + **shim HTTP compatível com o Supabase** (`tests/e2e/supabase-shim/server.mjs`, apenas para testes) que executa SQL real sob o papel da usuária — ou seja, o **RLS real** é exercitado.

| Teste | Projeto |
|---|---|
| Boas-vindas e navegação para cadastro | mobile |
| Validação do cadastro (campos, senha, consentimento) | mobile |
| Login inválido com mensagem amigável | mobile |
| Rotas protegidas redirecionam para login | mobile |
| Recuperação de senha sem revelar existência do e-mail | mobile |
| Política de privacidade, manifesto PWA, service worker e ícones | mobile |
| Cadastro + onboarding personalizam dashboard e perfil | mobile |
| “Nova ação” em linguagem natural cria tarefa que persiste após recarregar | mobile |
| Concluir tarefa atualiza status, pontos e conquista | mobile |
| Finanças: saldo real, gasto, nova conta, transferência sem alterar o total | mobile |
| Sono 23:00→07:00 = 8h (480 min no banco) | mobile |
| Hábito a partir de sugestão e conclusão | mobile |
| Hidratação por copos | mobile |
| Vilma sem chave de IA responde no modo básico com dados reais (lista pendências conforme o banco, registra água, salva a conversa) | mobile |
| Exclusão de tarefa exige confirmação | mobile |
| Meu plano: excluir tarefa e hábito pelo menu ⋮, com confirmação | mobile |
| Logout e proteção de sessão | mobile |
| Isolamento entre usuárias pela interface e por chamadas diretas à API | mobile |
| Offline: alteração entra na fila, aviso exibido e sincroniza ao reconectar | mobile |
| LGPD: exportação de dados (sem tokens) e exclusão definitiva da conta | mobile |
| Automações: tarefas atrasadas, sugestão de reagendamento, lembrete no horário exato, geração de contas fixas, idempotência e exibição em Notificações | mobile |
| Sem rolagem horizontal/conteúdo cortado em 24 telas, sem erros de JavaScript | mobile e desktop |
| Acessibilidade axe WCAG 2 A/AA sem violações críticas/sérias (10 telas) | mobile e desktop |

### Problemas encontrados pelos testes e corrigidos

- Binário nativo do compilador (SWC) truncado por instalação interrompida → reinstalação limpa.
- `numeric` retornado como número pelo PostgREST quebrava a edição de valores → campos tornados robustos.
- `scrollIntoView()` retorna Promise no Chromium atual e era devolvido como “cleanup” de efeito → travava a tela da Vilma.
- Divergência de hidratação em telas que leem cache local/relógio → renderização apenas no cliente nas telas internas.
- Reinscrição de canal Realtime em remontagens → tópico único por montagem.
- Contraste insuficiente de texto secundário e cores semânticas → tokens ajustados (≥ 4,5:1).
- Calendário com ARIA `grid` incompleto → grupo de botões rotulados.
- Logo sem gradiente quando havia mais de uma instância → ids únicos.
- Eixos de gráfico com rótulos cortados → largura ajustada.
- Contas fixas geradas numa execução só eram avisadas na execução seguinte → transações recarregadas após a geração.

## Versão local (`playwright.local.config.ts`)

Build estático com `basePath=/ROTINA-PESSOAL` servido como no GitHub Pages:
1. Cadastro e onboarding locais, “Nova ação”, saldo real, Vilma local registrando gasto e listando tarefas, persistência após recarregar, 21 telas sem erro e sem rolagem horizontal, sair/entrar e exportação de dados.
2. Duas contas no mesmo aparelho não enxergam os dados uma da outra.

Problema encontrado e corrigido: “gastei 45,90 no mercado” (sem “R$”) não era reconhecido como valor.

## O que NÃO foi testado neste ambiente (e por quê)

| Item | Motivo |
|---|---|
| Respostas reais da IA (Anthropic e Gemini) | sem chaves no ambiente; protocolo do Gemini testado com respostas simuladas, camada de ferramentas com testes unitários, modo básico com E2E |
| Google Agenda e Google Tasks reais | sem credenciais Google; sincronização testada contra um Google simulado que reproduz a API (inclusive o descarte do horário no Tasks) |
| Supabase hospedado (Auth por e-mail real, Storage, Realtime) | substituído pelo shim de testes; uploads (foto, anexos, vision board) e Realtime não foram exercitados |
| Login com Google | depende de provedor configurado no Supabase |
| Instalação do PWA em aparelhos físicos iOS/Android | ambiente sem dispositivos; manifesto, ícones e SW verificados por E2E |
| Notificações do sistema e entrega real de Web Push | requerem permissão interativa e serviço de push do navegador; envio coberto por teste unitário com remetente simulado |

## Como reproduzir

```bash
npm test             # unitários
npm run test:db      # requer PostgreSQL local (usuário postgres)
npm run test:e2e     # requer PostgreSQL local e Chromium do Playwright
SCREENSHOTS=1 npm run test:e2e -- tests/e2e/screenshots.spec.ts --project=mobile   # capturas para revisão visual
```
