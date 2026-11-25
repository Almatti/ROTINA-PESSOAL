import { defineConfig, devices } from "@playwright/test";

// Testa a versão estática "modo local" (gerada com NEXT_PUBLIC_BASE_PATH=/ROTINA-PESSOAL).
export default defineConfig({
  testDir: "tests/e2e-local",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3300", trace: "off", locale: "pt-BR", timezoneId: "America/Sao_Paulo", ...devices["Pixel 7"] },
  webServer: { command: "BASE=/ROTINA-PESSOAL PORT=3300 node scripts/serve-static.mjs out", url: "http://localhost:3300/ROTINA-PESSOAL/", reuseExistingServer: false },
});
