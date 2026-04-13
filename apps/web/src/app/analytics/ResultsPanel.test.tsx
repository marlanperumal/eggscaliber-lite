import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { AnalyticsResult, QueryConfig } from "./analytics-types"
import { ResultsPanel } from "./ResultsPanel"

vi.mock("./AnalyticsChart", () => ({
  AnalyticsChart: () => <div data-testid="analytics-chart" />,
}))

const MEASURE = {
  type: "count" as const,
  field_key: null,
  aggregation: null,
  display: "n" as const,
}

const crosstabResult: AnalyticsResult = {
  meta: { mode: "crosstab", measure: MEASURE, dataset_name: "Wave 1", base_n: 100 },
  rows: [{ key: ["gender", "Female"], values: { Total: 10 } }],
}

const trendResult: AnalyticsResult = {
  meta: { mode: "trend", measure: MEASURE, collection_name: "Brand Tracker" },
  rows: [{ key: ["Wave 1", "brand_awareness", "Aware"], values: { Total: 10 } }],
}

const crosstabQuery: QueryConfig = {
  mode: "crosstab",
  dataset_id: 1,
  collection_id: null,
  rows: [],
  row_mode: "stacked",
  columns: [],
  col_mode: "stacked",
  breakdown: null,
  filters: [],
  measure: MEASURE,
}

const trendQuery: QueryConfig = {
  ...crosstabQuery,
  mode: "trend",
  dataset_id: null,
  collection_id: 1,
}

describe("ResultsPanel", () => {
  it("shows placeholder when result is null", () => {
    render(<ResultsPanel result={null} query={null} />)
    expect(screen.getByText("Configure a query and press Run.")).toBeInTheDocument()
  })

  it("Line button is disabled for a crosstab result", () => {
    render(<ResultsPanel result={crosstabResult} query={crosstabQuery} />)
    expect(screen.getByRole("button", { name: "Line" })).toBeDisabled()
  })

  it("Line button is enabled for a trend result", () => {
    render(<ResultsPanel result={trendResult} query={trendQuery} />)
    expect(screen.getByRole("button", { name: "Line" })).not.toBeDisabled()
  })

  it("shows chart and table by default (stacked view mode)", () => {
    render(<ResultsPanel result={crosstabResult} query={crosstabQuery} />)
    expect(screen.getByTestId("analytics-chart")).toBeInTheDocument()
    expect(screen.getByRole("table")).toBeInTheDocument()
  })
})
