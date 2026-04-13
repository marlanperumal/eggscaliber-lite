import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AnalyticsTable } from "./AnalyticsTable"
import type { AnalyticsResult } from "./analytics-types"

const MEASURE = {
  type: "count" as const,
  field_key: null,
  aggregation: null,
  display: "n" as const,
}

function makeResult(overrides: Partial<AnalyticsResult>): AnalyticsResult {
  return {
    meta: { mode: "crosstab", measure: MEASURE, ...overrides.meta },
    rows: overrides.rows ?? [],
  }
}

describe("AnalyticsTable", () => {
  it("shows no-data message when rows are empty", () => {
    render(<AnalyticsTable result={makeResult({ rows: [] })} />)
    expect(screen.getByText("No data.")).toBeInTheDocument()
  })

  it("stacked mode renders single row header from row_fields and key[1] as cell value", () => {
    const result = makeResult({
      meta: {
        mode: "crosstab",
        measure: MEASURE,
        row_fields: [{ field_key: "gender", display_name: "Gender" }],
      },
      rows: [{ key: ["gender", "Female"], values: { Total: 10 } }],
    })
    render(<AnalyticsTable result={result} />)
    expect(screen.getByRole("columnheader", { name: "Gender" })).toBeInTheDocument()
    expect(screen.getByText("Female")).toBeInTheDocument()
  })

  it("nested mode (key length 4) renders two row headers and key[1] + key[3] as cell values", () => {
    const result = makeResult({
      meta: {
        mode: "crosstab",
        measure: MEASURE,
        row_fields: [
          { field_key: "region", display_name: "Region" },
          { field_key: "channel", display_name: "Channel" },
        ],
      },
      rows: [{ key: ["region", "North", "channel", "TV"], values: { Total: 5 } }],
    })
    render(<AnalyticsTable result={result} />)
    expect(screen.getByRole("columnheader", { name: "Region" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Channel" })).toBeInTheDocument()
    expect(screen.getByText("North")).toBeInTheDocument()
    expect(screen.getByText("TV")).toBeInTheDocument()
  })

  it("trend mode renders Wave, Field, Level headers and key[0..2] as cell values", () => {
    const result = makeResult({
      meta: { mode: "trend", measure: MEASURE },
      rows: [{ key: ["Wave 1", "brand_awareness", "Aware"], values: { Total: 10 } }],
    })
    render(<AnalyticsTable result={result} />)
    expect(screen.getByRole("columnheader", { name: "Wave" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Field" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Level" })).toBeInTheDocument()
    expect(screen.getByText("Wave 1")).toBeInTheDocument()
    expect(screen.getByText("brand_awareness")).toBeInTheDocument()
    expect(screen.getByText("Aware")).toBeInTheDocument()
  })

  it("stacked mode does not render nested headers when key length is 2", () => {
    const result = makeResult({
      meta: {
        mode: "crosstab",
        measure: MEASURE,
        row_fields: [
          { field_key: "region", display_name: "Region" },
          { field_key: "channel", display_name: "Channel" },
        ],
      },
      rows: [{ key: ["region", "North"], values: { Total: 5 } }],
    })
    render(<AnalyticsTable result={result} />)
    // Only first row_field header shown in stacked mode
    expect(screen.getByRole("columnheader", { name: "Region" })).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "Channel" })).not.toBeInTheDocument()
  })
})
