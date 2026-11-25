import { defineConfig, devices } from "@playwright/test";

// Executado via `npm run test:e2e` (scripts/e2e.sh prepara banco, shim e build).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", trace: "off", locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  webServer: [
    { command: "node tests/e2e/supabase-shim/server.mjs", url: "http://127.0.0.1:54321/auth/v1/settings", reuseExistingServer: false, timeout: 30_000 },
    { command: process.env.E2E_DEV ? "npx next dev -p 3100" : "npx next start -p 3100", url: "http://localhost:3100", reuseExistingServer: false, timeout: 120_000 },
  ],
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } }, testMatch: /responsive|a11y/ },
  ],
});
