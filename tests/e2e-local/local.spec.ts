import { test, expect, type Page } from "@playwright/test";

const B = "/ROTINA-PESSOAL";
const PASSWORD = "Senha1234";

async function createAccount(page: Page, email: string) {
  await page.goto(`${B}/cadastro/`);
  await expect(page.getByText(/Modo local/)).toBeVisible();
  await page.getByLabel("Nome").fill("Vilma Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirme a senha").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel(/Saldo atual da sua conta principal/).fill("1.000,00");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Começar a usar" }).click();
  await expect(page).toHaveURL(/inicio/);
}

test("modo local: conta, dados persistentes, Vilma local e todas as telas", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));

  await page.goto(`${B}/`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Todos os seus apps");
  await createAccount(page, "eu@local.app");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Vilma");

  // nova ação → tarefa
  await page.getByRole("button", { name: /Nova ação/ }).click();
  await page.getByLabel("Escreva do seu jeito").fill("Lembre-me de pagar a internet dia 10");
  await page.getByRole("button", { name: "Interpretar" }).click();
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByText("Tarefa criada!")).toBeVisible();

  // finanças com saldo do onboarding
  await page.goto(`${B}/financas/`);
  await expect(page.getByText("R$ 1.000,00").first()).toBeVisible();

  // Vilma local
  await page.goto(`${B}/vilma/`);
  await page.getByLabel("Mensagem para a Vilma").fill("gastei 45,90 no mercado");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(/Gasto registrado: .*R\$ 45,90/)).toBeVisible();
  await page.getByLabel("Mensagem para a Vilma").fill("quais tarefas estão pendentes?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(/pagar a internet/i).last()).toBeVisible();

  // persiste após recarregar e entre telas
  await page.reload();
  await page.goto(`${B}/financas/`);
  await expect(page.getByText("R$ 954,10").first()).toBeVisible();
  await page.goto(`${B}/tarefas/`);
  await expect(page.getByText(/pagar a internet/i)).toBeVisible();

  // todas as telas abrem sem erro e sem rolagem horizontal
  for (const r of ["inicio", "meu-plano", "tracker", "bem-estar", "agenda", "habitos", "sono", "humor", "ciclo", "agua", "treinos", "trabalho", "estudos", "casa", "notas", "metas", "foco", "conquistas", "notificacoes", "perfil", "configuracoes"]) {
    await page.goto(`${B}/${r}/`);
    await expect(page.locator("main h1").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, r).toBeLessThanOrEqual(1);
  }

  // sair e entrar de novo
  await page.goto(`${B}/configuracoes/`);
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/entrar/);
  await page.goto(`${B}/inicio/`);
  await expect(page).toHaveURL(/entrar/);
  await page.getByLabel("E-mail").fill("eu@local.app");
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/inicio/);

  // exportação de dados
  await page.goto(`${B}/configuracoes/`);
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exportar todos os meus dados/ }).click();
  const file = await dl;
  const json = JSON.parse(await (await import("node:fs")).promises.readFile((await file.path())!, "utf8"));
  expect(json.modo).toBe("local");
  expect(json.tasks.length).toBe(1);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("modo local: duas contas no mesmo aparelho não veem os dados uma da outra", async ({ page }) => {
  await createAccount(page, `a${Date.now()}@local.app`);
  await page.goto(`${B}/tarefas/`);
  await page.getByRole("button", { name: "Nova", exact: true }).click();
  await page.getByLabel("Título").fill("Segredo da A");
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByText("Segredo da A")).toBeVisible();
  await page.goto(`${B}/configuracoes/`);
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await createAccount(page, `b${Date.now()}@local.app`);
  await page.goto(`${B}/tarefas/`);
  await expect(page.getByText("Nenhuma tarefa encontrada")).toBeVisible();
});
