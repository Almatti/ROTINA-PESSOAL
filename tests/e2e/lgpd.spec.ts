import { test, expect } from "@playwright/test";
import { signup, onboard, uniqueEmail, PASSWORD } from "./helpers";

test("LGPD: exportação de dados e exclusão definitiva da conta", async ({ page }) => {
  const email = uniqueEmail("lgpd");
  await signup(page, "Lia Gomes", email);
  await onboard(page, { balance: "300" });
  // exportação
  const res = await page.request.get("/api/account/export");
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.conta.email).toBe(email);
  expect(data.perfil.full_name).toBe("Lia Gomes");
  expect(data.financial_accounts).toHaveLength(1);
  expect(JSON.stringify(data)).not.toContain("access_token_enc");
  // exclusão pela interface
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await page.getByLabel("Digite EXCLUIR para confirmar").fill("EXCLUIR");
  const del = page.waitForResponse((r) => r.url().includes("/api/account/delete"));
  await page.getByRole("button", { name: "Excluir conta", exact: true }).click();
  const delRes = await del;
  expect(delRes.status()).toBe(200);
  await expect(page).toHaveURL(/\/\?conta=excluida/);
  // não consegue mais entrar
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});
