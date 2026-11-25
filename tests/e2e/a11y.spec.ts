import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signup, onboard, uniqueEmail } from "./helpers";

async function audit(page: import("@playwright/test").Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = r.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  return serious.map((v) => `${name}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length}x) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
}

test("acessibilidade (axe WCAG A/AA): sem violações críticas/sérias", async ({ page }) => {
  test.setTimeout(180_000);
  const issues: string[] = [];
  for (const r of ["/", "/entrar", "/cadastro"]) { await page.goto(r); issues.push(...(await audit(page, r))); }
  await signup(page, "A11y Teste", uniqueEmail("a11y"));
  await onboard(page, { balance: "100" });
  for (const r of ["/inicio", "/meu-plano", "/financas", "/sono", "/humor", "/vilma", "/configuracoes"]) {
    await page.goto(r);
    await page.waitForLoadState("networkidle").catch(() => {});
    issues.push(...(await audit(page, r)));
  }
  expect(issues, issues.join("\n")).toEqual([]);
});
