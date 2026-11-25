import { test, expect } from "@playwright/test";
import { signup, onboard, uniqueEmail, restPost, rest } from "./helpers";

const isoDay = (offset = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + offset * 86400000));

test("automações: atrasadas, lembrete no horário, contas fixas e idempotência", async ({ page }) => {
  await signup(page, "Auto Teste", uniqueEmail("auto"));
  await onboard(page, { balance: "1000" });
  const acc = (await rest(page, "financial_accounts?select=id"))[0].id;
  await restPost(page, "tasks", [{ title: "Tarefa vencida", due_date: isoDay(-2) }]);
  const start = new Date(Date.now() + 5 * 60_000);
  await restPost(page, "events", [{ title: "Dentista", starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 3600_000).toISOString(), reminder_minutes: 15 }]);
  await restPost(page, "recurring_transactions", [{ type: "despesa", description: "Aluguel", amount: 1500, account_id: acc, day_of_month: Number(isoDay().slice(8)), start_date: isoDay(-40) }]);

  const run = async () => {
    const r = await page.request.post("/api/automations/run");
    expect(r.status()).toBe(200);
    return r.json();
  };
  const first = await run();
  expect(first.created).toBeGreaterThan(0);
  const notes = await rest(page, "notifications?select=title,dedupe_key");
  const titles = notes.map((n: { title: string }) => n.title);
  expect(titles.some((t: string) => /tarefa\(s\) atrasada/.test(t))).toBe(true);
  expect(titles).toContain("Lembrete: Dentista");
  expect(titles.some((t: string) => t === "Sugestão de reagendamento")).toBe(true);
  const txs = await rest(page, "transactions?select=description,status,recurring_id,amount");
  const aluguel = txs.filter((t: { recurring_id: string | null }) => t.recurring_id);
  expect(aluguel.length).toBeGreaterThanOrEqual(1);
  expect(aluguel[0]).toMatchObject({ description: "Aluguel", status: "pendente", amount: 1500 });

  // segunda execução não duplica nada
  await run();
  expect((await rest(page, "notifications?select=id")).length).toBe(notes.length);
  expect((await rest(page, "transactions?select=id&recurring_id=not.is.null")).length).toBe(aluguel.length);

  // a tela de notificações mostra os avisos
  await page.goto("/notificacoes");
  await expect(page.getByText("Lembrete: Dentista")).toBeVisible();
});
