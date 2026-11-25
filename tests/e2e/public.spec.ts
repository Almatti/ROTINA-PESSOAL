import { test, expect } from "@playwright/test";

test.describe("páginas públicas e autenticação", () => {
  test("boas-vindas apresenta o app e leva ao cadastro", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Todos os seus apps");
    await page.getByRole("link", { name: "Começar agora" }).click();
    await expect(page).toHaveURL(/\/cadastro/);
  });

  test("cadastro valida campos obrigatórios e senha", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Como podemos te chamar?")).toBeVisible();
    await expect(page.getByText("Informe seu e-mail.")).toBeVisible();
    await page.getByLabel("Senha", { exact: true }).fill("abc");
    await page.getByLabel("Confirme a senha").fill("abcd");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText(/pelo menos 8 caracteres/)).toBeVisible();
    await expect(page.getByText("É preciso aceitar a Política de Privacidade.")).toBeVisible();
  });

  test("login com credenciais inválidas mostra erro amigável", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill("ninguem@teste.local");
    await page.getByLabel("Senha").fill("Errada123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("rotas protegidas redirecionam para o login", async ({ page }) => {
    await page.goto("/financas");
    await expect(page).toHaveURL(/\/entrar\?next=%2Ffinancas/);
  });

  test("recuperação de senha não revela se o e-mail existe", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await page.getByLabel("E-mail").fill("qualquer@teste.local");
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByText(/Se houver uma conta com este e-mail/)).toBeVisible();
  });

  test("política de privacidade e manifesto PWA disponíveis", async ({ page, request }) => {
    await page.goto("/privacidade");
    await expect(page.getByRole("heading", { name: "Política de Privacidade" })).toBeVisible();
    const m = await (await request.get("/manifest.webmanifest")).json();
    expect(m.name).toBe("Vilma — Minha Vida");
    expect(m.display).toBe("standalone");
    expect((await request.get("/sw.js")).status()).toBe(200);
    expect((await request.get("/icons/icon-512.png")).status()).toBe(200);
  });
});
