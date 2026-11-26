import { test, expect } from "@playwright/test";
import { signup, onboard, login, uniqueEmail, rest } from "./helpers";

test.describe.configure({ mode: "serial" });

const email = uniqueEmail("ana");

test("cadastro + onboarding personalizam o dashboard", async ({ page }) => {
  await signup(page, "Ana Souza", email);
  await onboard(page, { nickname: "Aninha", balance: "1.000,00" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Aninha");
  await expect(page.getByText("Nova ação")).toBeVisible();
  const profile = await rest(page, "profiles?select=onboarding_completed,nickname,goals");
  expect(profile[0]).toMatchObject({ onboarding_completed: true, nickname: "Aninha" });
  expect(profile[0].goals).toContain("Ser mais produtiva");
});

test("nova ação em linguagem natural cria tarefa e ela persiste", async ({ page }) => {
  await login(page, email);
  await page.getByRole("button", { name: /Nova ação/ }).click();
  await page.getByLabel("Escreva do seu jeito").fill("Lembre-me de pagar a internet dia 10");
  await page.getByRole("button", { name: "Interpretar" }).click();
  await expect(page.getByRole("dialog", { name: "Nova tarefa" })).toBeVisible();
  await expect(page.getByLabel("Título")).toHaveValue(/pagar a internet/i);
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByText("Tarefa criada!")).toBeVisible();
  await page.goto("/tarefas");
  await expect(page.getByText(/pagar a internet/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/pagar a internet/i)).toBeVisible();
  const tasks = await rest(page, "tasks?select=title,due_date,status");
  expect(tasks).toHaveLength(1);
  expect(tasks[0].due_date.slice(8)).toBe("10");
});

test("concluir tarefa no plano atualiza o status", async ({ page }) => {
  await login(page, email);
  await page.goto("/tarefas");
  await page.getByRole("button", { name: /Concluir .*internet/i }).click();
  await expect.poll(async () => (await rest(page, "tasks?select=status"))[0].status).toBe("concluida");
  await expect.poll(async () => (await rest(page, "point_events?select=points,source")).some((p: { source: string }) => p.source === "tarefa")).toBe(true);
  await expect.poll(async () => (await rest(page, "user_achievements?select=achievement_key")).map((a: { achievement_key: string }) => a.achievement_key)).toContain("primeira_tarefa");
});

test("finanças: saldo real, gasto, transferência não altera o total", async ({ page }) => {
  await login(page, email);
  await page.goto("/financas");
  await expect(page.getByText("R$ 1.000,00").first()).toBeVisible();
  // gasto
  await page.getByRole("button", { name: "Gasto", exact: true }).click();
  await page.getByLabel("Valor (R$)").fill("150,00");
  await page.getByLabel("Descrição").fill("Mercado");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Registrado!")).toBeVisible();
  await expect(page.getByText("R$ 850,00").first()).toBeVisible();
  // nova conta + transferência
  await page.getByRole("tab", { name: "Contas" }).click();
  await page.getByRole("button", { name: "+ Conta" }).click();
  await page.getByLabel("Nome").fill("Reserva");
  await page.getByLabel(/Saldo atual/).fill("0");
  await page.getByRole("button", { name: "Salvar conta" }).click();
  await page.getByRole("button", { name: "Transferir entre contas" }).click();
  await page.getByLabel("Valor (R$)").fill("100");
  await page.getByLabel("Descrição").fill("Guardar");
  await page.getByLabel("Para a conta").selectOption({ label: "Reserva" });
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Registrado!")).toBeVisible();
  await page.getByRole("tab", { name: "Resumo" }).click();
  await expect(page.getByText("R$ 850,00").first()).toBeVisible(); // total inalterado
  await expect(page.getByText("Saiu no mês")).toBeVisible();
  const txs = await rest(page, "transactions?select=type,amount");
  expect(txs.map((t: { type: string }) => t.type).sort()).toEqual(["despesa", "transferencia"]);
});

test("sono atravessando a meia-noite registra 8h", async ({ page }) => {
  await login(page, email);
  await page.goto("/sono");
  await page.getByRole("button", { name: "Registrar minha noite" }).click();
  await page.getByLabel("Fui dormir").fill("23:00");
  await page.getByLabel("Acordei", { exact: true }).fill("07:00");
  await expect(page.getByText("Duração:")).toContainText("8h");
  await page.getByRole("button", { name: "Salvar noite" }).click();
  await expect(page.getByText(/Noite registrada: 8h/)).toBeVisible();
  const logs = await rest(page, "sleep_logs?select=duration_minutes");
  expect(logs[0].duration_minutes).toBe(480);
});

test("hábito: criar a partir de sugestão e marcar como feito", async ({ page }) => {
  await login(page, email);
  await page.goto("/habitos");
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Novo hábito" });
  await dialog.getByRole("button", { name: /Meditar/ }).first().click();
  await dialog.getByRole("button", { name: "Criar hábito" }).click();
  await expect(page.getByText("Hábito criado!")).toBeVisible();
  await page.getByRole("button", { name: "Concluir Meditar" }).click();
  await expect.poll(async () => (await rest(page, "habit_logs?select=completed"))[0]?.completed).toBe(true);
});

test("hidratação: copos registram consumo", async ({ page }) => {
  await login(page, email);
  await page.goto("/agua");
  await page.getByRole("button", { name: "Beber copo 1 (250 ml)" }).click();
  await expect(page.getByText(/^250/).first()).toBeVisible();
  const w = await rest(page, "water_logs?select=amount_ml");
  expect(w.reduce((s: number, x: { amount_ml: number }) => s + x.amount_ml, 0)).toBe(250);
});

test("Vilma sem chave de IA responde no modo básico com dados reais (sem simular IA)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message + "\n" + (e.stack ?? "").slice(0, 600)));
  await login(page, email);
  await page.goto("/vilma");
  await expect(page.getByText(/Eu sou a Vilma/)).toBeVisible();
  await expect(page.getByText(/modo básico/).first()).toBeVisible();
  await page.getByLabel("Mensagem para a Vilma").fill("Quais tarefas ainda estão pendentes?");
  await page.getByRole("button", { name: "Enviar" }).click();
  // a resposta precisa refletir o banco: nesta altura a única tarefa já foi concluída
  const pend = await rest(page, "tasks?select=id&status=in.(pendente,em_andamento)");
  await expect(page.getByText(pend.length ? /tarefa\(s\) pendente\(s\)/ : /não tem tarefas pendentes/)).toBeVisible();
  await page.getByLabel("Mensagem para a Vilma").fill("bebi 500 ml de água");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Água: +500 ml")).toBeVisible();
  await expect.poll(async () => (await rest(page, "water_logs?select=amount_ml")).reduce((s: number, x: { amount_ml: number }) => s + x.amount_ml, 0)).toBe(750);
  // a conversa fica salva no banco
  await expect.poll(async () => (await rest(page, "messages?select=id")).length).toBe(4);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Meu plano: excluir tarefa e hábito direto pelo menu ⋮ (com confirmação)", async ({ page }) => {
  await login(page, email);
  // o hábito "Meditar" foi criado no teste de hábitos; a tarefa é criada aqui (data padrão: hoje)
  await page.goto("/tarefas");
  await page.getByRole("button", { name: /Nova/ }).first().click();
  const form = page.getByRole("dialog", { name: "Nova tarefa" });
  await form.getByLabel("Título").fill("Tarefa para apagar");
  await form.getByRole("button", { name: "Criar tarefa" }).click();
  await expect.poll(async () => (await rest(page, "tasks?select=id&title=eq.Tarefa%20para%20apagar")).length).toBe(1);

  await page.goto("/meu-plano");
  await page.getByRole("button", { name: "Editar Tarefa para apagar" }).click();
  const edit = page.getByRole("dialog", { name: "Editar tarefa" });
  await edit.getByRole("button", { name: "Excluir tarefa" }).click();
  await expect(page.getByRole("dialog", { name: "Excluir tarefa?" })).toBeVisible();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect.poll(async () => (await rest(page, "tasks?select=id&title=eq.Tarefa%20para%20apagar")).length).toBe(0);

  await page.getByRole("button", { name: "Opções de Meditar" }).click();
  await page.getByRole("dialog", { name: "Editar hábito" }).getByRole("button", { name: "Excluir hábito" }).click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect.poll(async () => (await rest(page, "habits?select=id")).length).toBe(0);
});

test("excluir tarefa exige confirmação", async ({ page }) => {
  await login(page, email);
  await page.goto("/tarefas");
  await page.getByRole("tab", { name: "Todas" }).or(page.getByRole("button", { name: "Todas" })).first().click();
  await page.getByRole("button", { name: /Editar .*internet/i }).click();
  await page.getByRole("button", { name: "Excluir tarefa" }).click();
  await expect(page.getByRole("dialog", { name: "Excluir tarefa?" })).toBeVisible();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect.poll(async () => (await rest(page, "tasks?select=id")).length).toBe(0);
});

test("logout e proteção de sessão", async ({ page }) => {
  await login(page, email);
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/entrar/);
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/entrar/);
});
