import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AnalyticsChart } from "./AnalyticsChart"
import type { AnalyticsResult } from "./analytics-types"

const meta = {
  title: "Analytics/AnalyticsChart",
  component: AnalyticsChart,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ height: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnalyticsChart>

export default meta
type Story = StoryObj<typeof meta>

// ── Crosstab mock: Gender × Brand Awareness ────────────────────────────────

const crosstabResult: AnalyticsResult = {
  meta: {
    mode: "crosstab",
    row_fields: [{ field_key: "gender", display_name: "Gender" }],
    col_fields: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
    row_mode: "stacked",
    col_mode: "stacked",
    measure: { type: "count", field_key: null, aggregation: null, display: "n" },
    dataset_name: "Wave 3 – Brand Tracker",
    base_n: 1200,
  },
  rows: [
    { key: ["gender", "Male"], values: { Aware: 248, Unaware: 152, Total: 400 } },
    { key: ["gender", "Female"], values: { Aware: 312, Unaware: 88, Total: 400 } },
    { key: ["gender", "Non-binary"], values: { Aware: 198, Unaware: 202, Total: 400 } },
  ],
}

// ── Trend mock: Satisfaction across 4 waves ────────────────────────────────

const trendResult: AnalyticsResult = {
  meta: {
    mode: "trend",
    fields: [{ field_key: "satisfaction", display_name: "Satisfaction" }],
    breakdown: null,
    measure: { type: "count", field_key: null, aggregation: null, display: "pct_col" },
    collection_name: "Brand Tracker",
  },
  rows: [
    { key: ["Q1 2024", "satisfaction", "Very satisfied"], values: { Total: 22 } },
    { key: ["Q1 2024", "satisfaction", "Satisfied"], values: { Total: 38 } },
    { key: ["Q1 2024", "satisfaction", "Neutral"], values: { Total: 24 } },
    { key: ["Q1 2024", "satisfaction", "Dissatisfied"], values: { Total: 16 } },
    { key: ["Q2 2024", "satisfaction", "Very satisfied"], values: { Total: 25 } },
    { key: ["Q2 2024", "satisfaction", "Satisfied"], values: { Total: 41 } },
    { key: ["Q2 2024", "satisfaction", "Neutral"], values: { Total: 21 } },
    { key: ["Q2 2024", "satisfaction", "Dissatisfied"], values: { Total: 13 } },
    { key: ["Q3 2024", "satisfaction", "Very satisfied"], values: { Total: 28 } },
    { key: ["Q3 2024", "satisfaction", "Satisfied"], values: { Total: 44 } },
    { key: ["Q3 2024", "satisfaction", "Neutral"], values: { Total: 18 } },
    { key: ["Q3 2024", "satisfaction", "Dissatisfied"], values: { Total: 10 } },
    { key: ["Q4 2024", "satisfaction", "Very satisfied"], values: { Total: 31 } },
    { key: ["Q4 2024", "satisfaction", "Satisfied"], values: { Total: 46 } },
    { key: ["Q4 2024", "satisfaction", "Neutral"], values: { Total: 15 } },
    { key: ["Q4 2024", "satisfaction", "Dissatisfied"], values: { Total: 8 } },
  ],
}

// ── Stories ────────────────────────────────────────────────────────────────

export const GroupedBar: Story = {
  args: { result: crosstabResult, chartType: "grouped_bar" },
}

export const StackedBar: Story = {
  args: { result: crosstabResult, chartType: "stacked_bar" },
}

export const StackedBar100: Story = {
  args: { result: crosstabResult, chartType: "stacked_bar_100" },
}

export const LineChart: Story = {
  args: { result: trendResult, chartType: "line" },
}

export const ManySeries: Story = {
  name: "Many series (8 chart colours)",
  args: {
    chartType: "grouped_bar",
    result: {
      meta: {
        mode: "crosstab",
        row_fields: [{ field_key: "age_group", display_name: "Age Group" }],
        col_fields: [{ field_key: "region", display_name: "Region" }],
        row_mode: "stacked",
        col_mode: "stacked",
        measure: { type: "count", field_key: null, aggregation: null, display: "n" },
        dataset_name: "National Survey",
        base_n: 8000,
      },
      rows: [
        {
          key: ["age_group", "18–24"],
          values: {
            North: 120,
            South: 98,
            East: 143,
            West: 87,
            Central: 110,
            Coastal: 95,
            Highland: 72,
            Island: 45,
            Total: 770,
          },
        },
        {
          key: ["age_group", "25–34"],
          values: {
            North: 185,
            South: 162,
            East: 198,
            West: 143,
            Central: 170,
            Coastal: 155,
            Highland: 98,
            Island: 62,
            Total: 1173,
          },
        },
        {
          key: ["age_group", "35–44"],
          values: {
            North: 201,
            South: 178,
            East: 215,
            West: 168,
            Central: 190,
            Coastal: 172,
            Highland: 115,
            Island: 74,
            Total: 1313,
          },
        },
      ],
    },
  },
}
