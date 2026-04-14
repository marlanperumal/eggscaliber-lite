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
    await expect(page.getByText("Brand Awareness")).toBeVisible({ timeout: 10_000 })

    // Add "Brand Awareness" to rows via the +R button
    await page.getByText("Brand Awareness").hover()
    await page.getByRole("button", { name: "+R" }).first().click()

    // Confirm it appeared in the Rows zone
    await expect(
      page.locator("[class*=bg-muted]").filter({ hasText: "Brand Awareness" }),
    ).toBeVisible()

    // Run the query
    await page.getByRole("button", { name: "Run" }).click()

    // Results panel should show the dataset name and data
    await expect(page.getByText("Wave 1")).toBeVisible({ timeout: 15_000 })
    // n should be a real number, not "—"
    await expect(page.getByText(/n = \d+/)).toBeVisible()
    // Level labels should appear (not raw codes)
    await expect(page.getByText("Aware")).toBeVisible()
    await expect(page.getByText("Not Aware")).toBeVisible()
  })

  test("cross-tab: add column variable, results show column breakdown", async ({ page }) => {
    await page.goto("/analytics")
    await expect(page.getByText("Configure a query and press Run.")).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole("combobox", { name: /select dataset/i }).selectOption({
      label: "Demo Data › Brand Tracker › Wave 1",
    })
    await expect(page.getByText("Brand Awareness")).toBeVisible({ timeout: 10_000 })

    // Add Brand Awareness to rows
    await page.getByText("Brand Awareness").hover()
    await page.getByRole("button", { name: "+R" }).first().click()

    // Add Gender to columns
    await page.getByText("Gender").hover()
    const colButtons = page.getByRole("button", { name: "+C" })
    await colButtons.first().click()

    // Gender should appear in the Columns zone
    await expect(
      page.locator("[class*=bg-muted]").filter({ hasText: "Gender" }),
    ).toBeVisible()

    await page.getByRole("button", { name: "Run" }).click()

    // Column headers should show gender display labels, not codes
    await expect(page.getByRole("columnheader", { name: "Male" })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("columnheader", { name: "Female" })).toBeVisible()
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
    await expect(page.getByText("Brand Awareness")).toBeVisible({ timeout: 10_000 })

    // Add Brand Awareness to fields
    await page.getByText("Brand Awareness").hover()
    await page.getByRole("button", { name: "+R" }).first().click()

    await page.getByRole("button", { name: "Run" }).click()

    // Results should show wave names and n count
    await expect(page.getByText("Brand Tracker")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/n = \d+/)).toBeVisible()
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
    await expect(page.getByText("Brand Awareness")).toBeVisible({ timeout: 10_000 })

    await page.getByText("Brand Awareness").hover()
    await page.getByRole("button", { name: "+R" }).first().click()
    await page.getByRole("button", { name: "Run" }).click()
    await expect(page.getByText(/n = \d+/)).toBeVisible({ timeout: 15_000 })

    // Remove the field — query now differs from what was run
    await page.getByRole("button", { name: "" }).filter({ hasText: "" }).first().click()
    // X button inside the rows chip
    const rowChip = page.locator("[class*=bg-muted]").filter({ hasText: "Brand Awareness" })
    await rowChip.getByRole("button").click()

    // Stale indicator should appear
    await expect(page.getByText(/stale/i)).toBeVisible()
  })
})
