import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 1 passkey E2E suite. Runs serially (workers: 1, fullyParallel: false)
 * because the WebAuthn virtual authenticator is attached per browser context
 * and the suite shares state between enrollment and login specs.
 *
 * Required env vars (see .env.e2e.example):
 *   E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY — test project + admin key
 *   E2E_BASE_URL (optional, defaults to https://localhost:3000)
 *   NEXT_PUBLIC_APP_URL — must equal E2E_BASE_URL so the passkey RP ID matches
 */
export default defineConfig({
  testDir: "./tests/e2e/specs",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://localhost:3000",
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: process.env.CI
    ? {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 120_000
      }
    : undefined
});
