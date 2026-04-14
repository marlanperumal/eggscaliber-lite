/**
 * Analytics E2E smoke tests
 *
 * These tests run against real dev servers (Next.js + FastAPI) and the real
 * local database. They are NOT part of the pre-commit hook or CI gate — run
 * them manually before a deploy or after significant analytics changes:
 *
 *   just test-e2e
 *
 * Seed data (from `just db-seed`) is required. Tests use the "Brand Tracker"
 * collection and "Wave 1" dataset which are seeded by the demo-data seed script.
 */
import { expect, test } from "./fixtures"

test.describe("Analytics page", () => {
  test("loads without 404 when feature flag is enabled", async ({ page }) => {
    await page.goto("/analytics")
    // Should not be a 404 page
    await expect(page.getByText("Configure a query and press Run.")).toBeVisible({
      timeout: 15_000,
    })
  })

  test("cross-tab: select dataset, add field, run query, see results", async ({ page }) => {
    await page.goto("/analytics")
    await expect(page.getByText("Configure a query and press Run.")).toBeVisible({
      timeout: 15_000,
    })

    // Select "Brand Tracker › Wave 1" dataset from the scope picker
    await page.getByRole("combobox", { name: /select dataset/i }).selectOption({
      label: "Demo Data › Brand Tracker › Wave 1",
    })

    // Wait for the field tree to populate
    await expect(page.getByTestId("field-row-brand_awareness")).toBeVisible({ timeout: 10_000 })

    // Add "Brand Awareness" to rows via the +R button
    await page.getByTestId("field-row-brand_awareness").hover()
    await page.getByTestId("field-row-brand_awareness").getByRole("button", { name: "+R" }).click()

    // Confirm chip appeared in Rows zone
    await expect(page.getByTestId("field-chip-brand_awareness")).toBeVisible()

    // Run the query
    await page.getByRole("button", { name: "Run" }).click()

    // Results panel should show the dataset name and data
    const results = page.getByTestId("results-panel")
    await expect(results.getByText("Wave 1")).toBeVisible({ timeout: 15_000 })
    // n should be a real number, not "—"
    await expect(results.getByText(/n = \d+/)).toBeVisible()
    // Level labels should appear (not raw codes)
    await expect(page.getByRole("cell", { name: "Aware", exact: true })).toBeVisible()
    await expect(page.getByRole("cell", { name: "Not Aware", exact: true })).toBeVisible()
  })

  test("cross-tab: add column variable, results show column breakdown", async ({ page }) => {
    await page.goto("/analytics")
    await expect(page.getByText("Configure a query and press Run.")).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole("combobox", { name: /select dataset/i }).selectOption({
      label: "Demo Data › Brand Tracker › Wave 1",
    })
    await expect(page.getByTestId("field-row-brand_awareness")).toBeVisible({ timeout: 10_000 })

    // Add Brand Awareness to rows
    await page.getByTestId("field-row-brand_awareness").hover()
    await page.getByTestId("field-row-brand_awareness").getByRole("button", { name: "+R" }).click()

    // Add Gender to columns
    await page.getByTestId("field-row-gender").hover()
    await page.getByTestId("field-row-gender").getByRole("button", { name: "+C" }).click()

    // Gender chip should appear in the Columns zone
    await expect(page.getByTestId("field-chip-gender")).toBeVisible()

    await page.getByRole("button", { name: "Run" }).click()

    // Column headers should show gender display labels, not codes
    await expect(page.getByRole("columnheader", { name: "Male", exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("columnheader", { name: "Female", exact: true })).toBeVisible()
  })

  test("trending: select collection, add field, run query, see trend results", async ({ page }) => {
    await page.goto("/analytics")
    await expect(page.getByText("Configure a query and press Run.")).toBeVisible({
      timeout: 15_000,
    })

    // Switch to Trending mode
    await page.getByRole("button", { name: "Trending" }).click()

    // Select "Brand Tracker" collection
    await page.getByRole("combobox", { name: /select collection/i }).selectOption({
      label: "Demo Data › Brand Tracker",
    })
    await expect(page.getByTestId("field-row-brand_awareness")).toBeVisible({ timeout: 10_000 })

    // Add Brand Awareness to fields
    await page.getByTestId("field-row-brand_awareness").hover()
    await page.getByTestId("field-row-brand_awareness").getByRole("button", { name: "+R" }).click()

    await page.getByRole("button", { name: "Run" }).click()

    // Results panel should show the collection name and n count
    const results = page.getByTestId("results-panel")
    await expect(results.getByText("Brand Tracker")).toBeVisible({ timeout: 15_000 })
    await expect(results.getByText(/n = \d+/)).toBeVisible()
    // Trend table has Wave column with dataset names
    await expect(page.getByRole("columnheader", { name: "Wave" })).toBeVisible()
  })

  test("stale indicator appears after modifying query post-run", async ({ page }) => {
    await page.goto("/analytics")
    await expect(page.getByText("Configure a query and press Run.")).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole("combobox", { name: /select dataset/i }).selectOption({
      label: "Demo Data › Brand Tracker › Wave 1",
    })
    await expect(page.getByTestId("field-row-brand_awareness")).toBeVisible({ timeout: 10_000 })

    await page.getByTestId("field-row-brand_awareness").hover()
    await page.getByTestId("field-row-brand_awareness").getByRole("button", { name: "+R" }).click()
    await page.getByRole("button", { name: "Run" }).click()
    await expect(page.getByTestId("results-panel").getByText(/n = \d+/)).toBeVisible({ timeout: 15_000 })

    // Remove the field via the × button inside the chip — query now differs from what was run
    await page.getByTestId("field-chip-brand_awareness").getByRole("button").click()

    // Stale indicator should appear
    await expect(page.getByText(/stale/i)).toBeVisible()
  })
})
