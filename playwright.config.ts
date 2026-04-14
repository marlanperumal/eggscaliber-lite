import { defineConfig, devices } from "@playwright/test"

/**
 * E2E tests — not part of pre-commit or CI by default.
 * Run manually during development: just test-e2e
 *
 * Both dev servers must be running before you invoke this:
 *   just dev          # starts API on :8000 and web on :3000
 *   just db-seed      # seeds demo-data if not already present
 *   just test-e2e     # then run this
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["line"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
