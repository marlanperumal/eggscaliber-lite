import { test as base } from "@playwright/test"

/**
 * PostHog's decide endpoint controls feature flag resolution.
 * We intercept it in every E2E test so pages behind feature flags render
 * correctly without needing a live PostHog account or configured flags.
 */
const POSTHOG_DECIDE_MOCK = {
  featureFlags: {
    "analytics-engine": true,
  },
  featureFlagPayloads: {},
  errorsWhileComputingFlags: false,
  capturePerformance: false,
  autocaptureExceptions: false,
}

export const test = base.extend<object>({
  page: async ({ page }, use) => {
    // Intercept PostHog decide calls before any navigation
    await page.route("**/decide**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(POSTHOG_DECIDE_MOCK),
      }),
    )
    // Swallow PostHog capture/ingestion calls so tests don't depend on network
    await page.route("**/ingest/e/**", (route) => route.fulfill({ status: 200, body: "{}" }))
    await page.route("**/ingest/i/**", (route) => route.fulfill({ status: 200, body: "{}" }))
    await use(page)
  },
})

export { expect } from "@playwright/test"
