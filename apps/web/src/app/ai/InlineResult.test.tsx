import { createLoader } from "nuqs/server"
import { describe, expect, it } from "vitest"
import { analyticsParams } from "@/app/analytics/useAnalyticsState"
import { buildAnalyticsUrl } from "./InlineResult"

const loadAnalyticsParams = createLoader(analyticsParams)

function parseHrefWithAnalyticsLoader(href: string) {
  const search = href.split("?")[1] ?? ""
  // createLoader accepts a URLSearchParams (or the stringified form) and
  // returns the parsed state exactly as the analytics page's useQueryStates
  // would produce it.
  return loadAnalyticsParams(new URLSearchParams(search))
}

describe("buildAnalyticsUrl", () => {
  it("builds crosstab URL with required params", () => {
    const url = buildAnalyticsUrl(
      {
        dataset_id: 42,
        rows: [{ field_key: "gender" }],
        columns: [],
        row_mode: "stacked",
        col_mode: "stacked",
        filters: [],
        measure: { type: "count", display: "n", field_key: null, aggregation: null },
      },
      "crosstab",
    )
    expect(url).toContain("/analytics")
    expect(url).toContain("mode=crosstab")
    expect(url).toContain("ds=42")
    expect(url).toContain("gender")
  })

  it("builds trend URL with required params", () => {
    const url = buildAnalyticsUrl(
      {
        collection_id: 7,
        fields: [{ field_key: "brand_awareness" }],
        breakdown: null,
        filters: [],
        measure: { type: "count", display: "pct_col", field_key: null, aggregation: null },
      },
      "trend",
    )
    expect(url).toContain("mode=trend")
    expect(url).toContain("col=7")
    expect(url).toContain("brand_awareness")
  })

  it("includes breakdown in trend URL when present", () => {
    const url = buildAnalyticsUrl(
      {
        collection_id: 7,
        fields: [{ field_key: "brand_awareness" }],
        breakdown: { field_key: "gender" },
        filters: [],
        measure: { type: "count", display: "n", field_key: null, aggregation: null },
      },
      "trend",
    )
    expect(url).toContain("bd=gender")
  })
})

describe("buildAnalyticsUrl — nuqs round-trip", () => {
  // Task 15: the URL produced for the "Open in Analytics" link must, when
  // parsed by the same nuqs parser the analytics page uses, yield the
  // expected QueryState. Parsing via createLoader(analyticsParams) gives an
  // exact parity check: any drift between serialisation (InlineResult) and
  // deserialisation (useAnalyticsState) will surface here.

  it("crosstab URL parses back to the originating query state", async () => {
    const url = buildAnalyticsUrl(
      {
        dataset_id: 42,
        rows: [{ field_key: "gender" }],
        columns: [{ field_key: "region" }],
        row_mode: "nested",
        col_mode: "stacked",
        filters: [],
        measure: { type: "count", display: "pct_col", field_key: null, aggregation: null },
      },
      "crosstab",
    )

    const state = await parseHrefWithAnalyticsLoader(url)

    expect(state.mode).toBe("crosstab")
    expect(state.ds).toBe(42)
    expect(state.rows).toEqual([{ field_key: "gender" }])
    expect(state.cols).toEqual([{ field_key: "region" }])
    expect(state.row_mode).toBe("nested")
    expect(state.col_mode).toBe("stacked")
    expect(state.mt).toBe("count")
    expect(state.md).toBe("pct_col")
  })

  it("trend URL parses back to the originating query state", async () => {
    const url = buildAnalyticsUrl(
      {
        collection_id: 7,
        fields: [{ field_key: "brand_awareness" }],
        breakdown: { field_key: "gender" },
        filters: [],
        measure: { type: "count", display: "n", field_key: null, aggregation: null },
      },
      "trend",
    )

    const state = await parseHrefWithAnalyticsLoader(url)

    expect(state.mode).toBe("trend")
    expect(state.col).toBe(7)
    // Trend fields are serialised under the `rows` param (by design — see
    // buildAnalyticsUrl), so round-trip lands there.
    expect(state.rows).toEqual([{ field_key: "brand_awareness" }])
    expect(state.bd).toBe("gender")
    expect(state.mt).toBe("count")
    expect(state.md).toBe("n")
  })
})
