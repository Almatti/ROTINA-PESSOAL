import { test, expect } from "@playwright/test";
import { signup, onboard, uniqueEmail } from "./helpers";

const ROUTES = ["/inicio", "/meu-plano", "/tracker", "/bem-estar", "/vilma", "/agenda", "/tarefas", "/habitos", "/financas", "/sono", "/humor", "/agua", "/treinos", "/trabalho", "/estudos", "/casa", "/notas", "/metas", "/foco", "/conquistas", "/configuracoes", "/perfil", "/notificacoes", "/ciclo"];

test("nenhuma tela com rolagem horizontal ou conteúdo cortado", async ({ page }) => {
  test.setTimeout(240_000);
  await signup(page, "Resp Teste", uniqueEmail("resp"));
  await onboard(page, { balance: "500" });
  const problems: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  for (const r of ROUTES) {
    await page.goto(r);
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.locator("main h1").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) problems.push(`${r}: ${overflow}px`);
  }
  expect(problems, `overflow horizontal: ${problems.join(", ")}`).toEqual([]);
  expect(errors, errors.join("\n")).toEqual([]);
});
