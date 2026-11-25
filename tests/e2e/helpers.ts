import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Senha1234";
export const uniqueEmail = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@teste.local`;

export async function signup(page: Page, name: string, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirme a senha").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
}

export async function onboard(page: Page, opts: { nickname?: string; balance?: string } = {}) {
  await expect(page.getByRole("heading", { name: /Eu sou a Vilma/ })).toBeVisible();
  if (opts.nickname) await page.getByLabel(/Apelido/).fill(opts.nickname);
  await page.getByRole("button", { name: "Continuar" }).click(); // objetivos
  await page.getByRole("button", { name: "Ser mais produtiva" }).click();
  await page.getByRole("button", { name: "Continuar" }).click(); // rotina
  await page.getByRole("button", { name: "Continuar" }).click(); // metas
  if (opts.balance) await page.getByLabel(/Saldo atual da sua conta principal/).fill(opts.balance);
  await page.getByRole("button", { name: "Continuar" }).click(); // preferências
  await page.getByRole("button", { name: "Começar a usar" }).click();
  await expect(page).toHaveURL(/\/inicio/, { timeout: 30_000 });
}

export async function login(page: Page, email: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/inicio/);
}

/** Lê o token de acesso da sessão salva em cookie pelo @supabase/ssr. */
export async function accessToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const chunks = cookies.filter((c) => /-auth-token(\.\d+)?$/.test(c.name));
  const idx = (n: string) => Number(n.match(/\.(\d+)$/)?.[1] ?? -1);
  const parts = chunks.sort((a, b) => idx(a.name) - idx(b.name)).map((c) => c.value).join("");
  const raw = parts.startsWith("base64-") ? Buffer.from(parts.slice(7), "base64").toString() : decodeURIComponent(parts);
  return JSON.parse(raw).access_token;
}

export async function rest(page: Page, path: string) {
  const token = await accessToken(page);
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await page.request.get(`http://127.0.0.1:54321/rest/v1/${path}`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  return res.json();
}

export async function restPost(page: Page, path: string, data: unknown) {
  const token = await accessToken(page);
  const res = await page.request.post(`http://127.0.0.1:54321/rest/v1/${path}`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, Prefer: "return=representation", "Content-Type": "application/json" }, data });
  if (!res.ok()) throw new Error(`${path}: ${res.status()} ${await res.text()}`);
  return res.json();
}
