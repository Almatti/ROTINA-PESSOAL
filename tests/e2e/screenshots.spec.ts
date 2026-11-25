import { test } from "@playwright/test";
import { signup, onboard, uniqueEmail, restPost, rest } from "./helpers";

// Gera capturas para revisão visual: SCREENSHOTS=1 npm run test:e2e -- tests/e2e/screenshots.spec.ts --project=mobile
test.skip(!process.env.SCREENSHOTS, "apenas sob demanda");

const OUT = process.env.SCREENSHOTS_DIR ?? "test-results/screens";
const pad = (n: number) => String(n).padStart(2, "0");
function isoToday(offset = 0) {
  const d = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

test("capturas das telas principais (claro e escuro)", async ({ page }) => {
  test.setTimeout(300_000);
  await signup(page, "Dani Lima", uniqueEmail("dani"));
  await onboard(page, { nickname: "Dani", balance: "2.500,00" });
  const t = isoToday();
  // dados de exemplo da conta de teste (somente no banco descartável de testes)
  await restPost(page, "events", [
    { title: "Pilates", starts_at: `${t}T09:00:00-03:00`, ends_at: `${t}T10:00:00-03:00`, color: "#7451A6" },
    { title: "Reunião de projeto", starts_at: `${t}T14:00:00-03:00`, ends_at: `${t}T15:00:00-03:00`, color: "#4F86E8", area: "trabalho" },
    { title: "Jantar com amigas", starts_at: `${t}T19:00:00-03:00`, ends_at: `${t}T21:00:00-03:00`, color: "#D65A9A" },
  ]);
  await restPost(page, "tasks", [
    { title: "Responder e-mails", due_date: t, priority: "alta" },
    { title: "Colocar comida para a Maya", due_date: t, status: "concluida", completed_at: new Date().toISOString(), tags: ["Maya"] },
    { title: "Ler 20 min", due_date: t, due_time: "21:00" },
  ]);
  const habits = await restPost(page, "habits", [
    { name: "Beber água", emoji: "💧", target_value: 2000, unit: "ml", step_value: 250, color: "#4F86E8", period: "manha" },
    { name: "Meditar", emoji: "🧘", color: "#7451A6", period: "manha" },
    { name: "Skincare matinal", emoji: "🧴", color: "#D65A9A", period: "manha", checklist: [{ id: "a", label: "Limpeza" }, { id: "b", label: "Tônico" }, { id: "c", label: "Hidratante" }] },
    { name: "Ler 10 páginas", emoji: "📖", color: "#1FA08C", period: "noite", target_value: 10, unit: "páginas", step_value: 5 },
  ]);
  const logs = [];
  for (let i = 1; i <= 25; i++) for (const [j, h] of habits.entries()) if ((i + j) % 3 !== 0) logs.push({ habit_id: h.id, log_date: isoToday(-i), value: h.target_value, completed: true, checklist_done: h.checklist.map((c: { id: string }) => c.id) });
  logs.push({ habit_id: habits[1].id, log_date: t, value: 1, completed: true });
  logs.push({ habit_id: habits[0].id, log_date: t, value: 1250, completed: false });
  await restPost(page, "habit_logs", logs);
  const sleep = [];
  for (let i = 0; i < 7; i++) { const d = isoToday(-i); const m = [480, 450, 495, 420, 510, 465, 480][i]; const bed = new Date(new Date(`${d}T07:00:00-03:00`).getTime() - m * 60000); sleep.push({ sleep_date: d, bed_at: bed.toISOString(), wake_at: `${d}T07:00:00-03:00`, duration_minutes: m, quality: 4 }); }
  await restPost(page, "sleep_logs", sleep);
  await restPost(page, "mood_logs", Array.from({ length: 20 }, (_, i) => { const m = [5, 4, 3, 4, 5, 2, 4, 3, 5, 4][i % 10]; return { log_date: isoToday(-i), mood: m, emoji: ["😭", "😞", "🙂", "😄", "😍"][m - 1], energy: 3 + (i % 3), feelings: ["Grata"] }; }));
  await restPost(page, "water_logs", [{ amount_ml: 500, log_date: t }, { amount_ml: 750, log_date: t }]);
  const acc = (await rest(page, "financial_accounts?select=id"))[0].id;
  const cats = await rest(page, "categories?select=id,name&scope=eq.despesa");
  const cat = (n: string) => cats.find((c: { name: string }) => c.name === n)?.id;
  const ym = t.slice(0, 8);
  await restPost(page, "transactions", [
    { type: "receita", amount: 4200, description: "Salário", account_id: acc, occurred_on: `${ym}05` },
    { type: "despesa", amount: 402, description: "Mercado do mês", account_id: acc, occurred_on: `${ym}06`, category_id: cat("Mercado") },
    { type: "despesa", amount: 49.9, description: "Lanche", account_id: acc, occurred_on: `${ym}08`, category_id: cat("Alimentação") },
    { type: "despesa", amount: 1500, description: "Aluguel", account_id: acc, occurred_on: `${ym}10`, category_id: cat("Moradia") },
    { type: "despesa", amount: 180, description: "Internet", account_id: acc, occurred_on: isoToday(3), due_date: isoToday(3), status: "pendente", category_id: cat("Moradia") },
    { type: "despesa", amount: 120, description: "Academia", account_id: acc, occurred_on: isoToday(5), due_date: isoToday(5), status: "pendente", category_id: cat("Saúde") },
  ]);
  await restPost(page, "recurring_transactions", [{ type: "despesa", description: "Streaming", amount: 39.9, is_subscription: true, account_id: acc, day_of_month: 15 }]);
  await restPost(page, "goals", [{ title: "Reserva de emergência", area: "financeira", target_value: 10000, current_value: 3200, horizon: "anual" }, { title: "Ler 12 livros", area: "pessoal", target_value: 12, current_value: 5, unit: "livros" }]);

  const shots: [string, string][] = [["inicio", "/inicio"], ["meu-plano", "/meu-plano"], ["tracker", "/tracker"], ["financas", "/financas"], ["sono", "/sono"], ["humor", "/humor"], ["agenda", "/agenda"], ["vilma", "/vilma"], ["agua", "/agua"], ["metas", "/metas"], ["bem-estar", "/bem-estar"], ["tarefas", "/tarefas"]];
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate((th) => localStorage.setItem("vilma:theme", th), theme);
    for (const [i, [name, path]] of shots.entries()) {
      if (theme === "dark" && !["inicio", "financas", "sono", "meu-plano"].includes(name)) continue;
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${theme}-${pad(i)}-${name}.png`, fullPage: true });
    }
  }
});
