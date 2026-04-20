import { describe, expect, it } from "vitest"
import { buildAnalyticsUrl } from "./InlineResult"

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
