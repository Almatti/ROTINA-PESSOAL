import { test, expect } from "@playwright/test";
import { signup, onboard, uniqueEmail, rest } from "./helpers";

test("offline: registro fica na fila e sincroniza ao reconectar", async ({ page, context }) => {
  await signup(page, "Off Line", uniqueEmail("off"));
  await onboard(page);
  await page.goto("/agua");
  await expect(page.getByText("Registros do dia")).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByRole("button", { name: "+250" }).click();
  await expect(page.getByText(/Você está offline/)).toBeVisible();
  await expect(page.getByText(/aguardando sincronização/)).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await rest(page, "water_logs?select=amount_ml")).length, { timeout: 20_000 }).toBe(1);
  await expect(page.getByText(/aguardando sincronização/)).toHaveCount(0);
});
