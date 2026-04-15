import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { AnalyticsResult, QueryConfig } from "./analytics-types"
import { ResultsPanel } from "./ResultsPanel"

const meta = {
  title: "Analytics/ResultsPanel",
  component: ResultsPanel,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ height: 560, display: "flex" }}>
        <div
          style={{
            flex: 1,
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ResultsPanel>

export default meta
type Story = StoryObj<typeof meta>

const MEASURE = {
  type: "count" as const,
  field_key: null,
  aggregation: null,
  display: "n" as const,
}

const crosstabResult: AnalyticsResult = {
  meta: {
    mode: "crosstab",
    row_fields: [{ field_key: "gender", display_name: "Gender" }],
    col_fields: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
    row_mode: "stacked",
    col_mode: "stacked",
    measure: MEASURE,
    dataset_name: "Wave 3 – Brand Tracker",
    base_n: 1200,
  },
  rows: [
    { key: ["gender", "Male"], values: { Aware: 248, Unaware: 152, Total: 400 } },
    { key: ["gender", "Female"], values: { Aware: 312, Unaware: 88, Total: 400 } },
  ],
}

const baseQuery: QueryConfig = {
  mode: "crosstab",
  dataset_id: 1,
  collection_id: null,
  rows: [{ field_key: "gender", display_name: "Gender" }],
  row_mode: "stacked",
  columns: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
  col_mode: "stacked",
  breakdown: null,
  filters: [],
  measure: MEASURE,
}

export const Empty: Story = {
  name: "Empty — no results yet",
  args: { result: null, query: null, lastRunQuery: null, isLoading: false },
}

export const Loading: Story = {
  name: "Loading — query running",
  args: { result: null, query: baseQuery, lastRunQuery: null, isLoading: true },
}

export const WithResult: Story = {
  name: "With result — crosstab",
  args: { result: crosstabResult, query: baseQuery, lastRunQuery: baseQuery, isLoading: false },
}
