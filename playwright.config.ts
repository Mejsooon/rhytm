import { defineConfig, devices } from "@playwright/test";
import { missingEnv } from "./e2e/e2e-env";

// Testy end-to-end lądują w e2e/ (vitest szuka tylko w src/). Dev server startuje sam.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Bez kluczy spec jest pomijany, więc nie ma sensu stawiać serwera deweloperskiego.
  webServer: missingEnv.length > 0 ? undefined : {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
