import { test as base } from "@playwright/test"

/**
 * PostHog v1.359+ uses the /flags v2 endpoint (not /decide) for feature flag
 * resolution. The v2 response format represents each flag as an object with an
 * explicit `enabled` field — not a plain boolean. We intercept at the network
 * level so pages behind feature flags render correctly without a live PostHog
 * account.
 */
const POSTHOG_FLAGS_MOCK = {
  flags: {
    "analytics-engine": {
      key: "analytics-engine",
      enabled: true,
      variant: null,
      reason: {},
      metadata: {},
    },
  },
  errorsWhileComputingFlags: false,
  requestId: "e2e-mock",
}

export const test = base.extend<object>({
  page: async ({ page }, use) => {
    const flagsMockBody = JSON.stringify(POSTHOG_FLAGS_MOCK)

    // Intercept PostHog flags endpoint. PostHog posts to /ingest/flags/ (with
    // trailing slash) which would normally redirect. Use a regex to match both
    // /flags/ and /flags? forms so the mock is returned immediately.
    await page.route(/\/flags[\/?]/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: flagsMockBody,
      }),
    )
    // Swallow PostHog capture/ingestion calls so tests don't depend on network
    await page.route("**/ingest/e/**", (route) => route.fulfill({ status: 200, body: "{}" }))
    await page.route("**/ingest/i/**", (route) => route.fulfill({ status: 200, body: "{}" }))
    await use(page)
  },
})

export { expect } from "@playwright/test"
