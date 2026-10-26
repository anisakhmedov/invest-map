import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const channel = process.env.E2E_CHANNEL ?? "chrome";

/**
 * End-to-end tests run against a production build (`pnpm build`) with the real database.
 * They use the Chrome that is already installed (no browser download); set E2E_CHANNEL="" to use Playwright's own.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  workers: 4,
  retries: 1,
  timeout: 45_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], ...(channel ? { channel } : {}) } }],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/ru`,
    // The local .env uses development passwords, which the production start-up check would refuse.
    env: { SKIP_ENV_CHECK: "1" },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
