import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { AICrosstabResultPart, AITrendResultPart } from "./ai-types"
import { InlineResult } from "./InlineResult"

const crosstabPart: AICrosstabResultPart = {
  type: "crosstab_result",
  query_config: {
    dataset_id: 1,
    rows: [{ field_key: "gender" }],
    columns: [],
    row_mode: "stacked",
    col_mode: "stacked",
    filters: [],
    measure: { type: "count", display: "pct_col", field_key: null, aggregation: null },
  },
  data: {
    meta: {
      mode: "crosstab",
      row_fields: [{ field_key: "gender", display_name: "Gender" }],
      col_fields: [],
      row_mode: "stacked",
      col_mode: "stacked",
      measure: { type: "count", display: "pct_col", field_key: null, aggregation: null },
      dataset_name: "Brand Tracker Wave 1",
      base_n: 1200,
      level_labels: { gender: { M: "Male", F: "Female" } },
    },
    rows: [
      { key: ["gender", "M"], values: { Total: 52.0 } },
      { key: ["gender", "F"], values: { Total: 48.0 } },
    ],
  },
}

const trendPart: AITrendResultPart = {
  type: "trend_result",
  query_config: {
    collection_id: 1,
    fields: [{ field_key: "brand_awareness" }],
    breakdown: null,
    filters: [],
    measure: { type: "count", display: "pct_col", field_key: null, aggregation: null },
  },
  data: {
    meta: {
      mode: "trend",
      fields: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
      breakdown: null,
      measure: { type: "count", display: "pct_col", field_key: null, aggregation: null },
      collection_name: "Brand Tracker",
      base_n: 4800,
      level_labels: { brand_awareness: { "1": "Yes", "0": "No" } },
    },
    rows: [
      { key: ["Wave 1", "brand_awareness", "1"], values: { Total: 42.0 } },
      { key: ["Wave 2", "brand_awareness", "1"], values: { Total: 51.0 } },
      { key: ["Wave 3", "brand_awareness", "1"], values: { Total: 59.0 } },
      { key: ["Wave 4", "brand_awareness", "1"], values: { Total: 67.0 } },
    ],
  },
}

const meta = {
  component: InlineResult,
} satisfies Meta<typeof InlineResult>

export default meta
type Story = StoryObj<typeof meta>

export const CrosstabResult: Story = { args: { part: crosstabPart } }
export const TrendResult: Story = { args: { part: trendPart } }
