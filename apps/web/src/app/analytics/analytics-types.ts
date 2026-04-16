import type { components } from "@shared/api"

export type AnalysisMode = "crosstab" | "trend"
export type RowColMode = "stacked" | "nested"
export type MeasureType = "count" | "weighted" | "value_field"
export type DisplayType = "n" | "pct_col" | "pct_row"
export type ChartType = "grouped_bar" | "stacked_bar" | "stacked_bar_100" | "line"
export type ViewMode = "chart_only" | "table_only" | "stacked" | "side_by_side"

// UI-only extension of the API FieldSelection — adds display metadata not sent to the API
export type FieldSelection = components["schemas"]["FieldSelection"] & {
  display_name?: string
  field_type?: string
}

// UI-only extension of the API FilterSpec — adds display_name for chip labels (not sent to API)
export type FilterSpec = components["schemas"]["FilterSpec"] & {
  display_name?: string
}

// Use the generated type directly — local definition was identical
export type MeasureSpec = components["schemas"]["MeasureSpec"]

export interface QueryConfig {
  mode: AnalysisMode
  dataset_id: number | null
  collection_id: number | null
  rows: FieldSelection[]
  row_mode: RowColMode
  columns: FieldSelection[]
  col_mode: RowColMode
  breakdown: FieldSelection | null
  filters: FilterSpec[]
  measure: MeasureSpec
}

export interface ResultRow {
  key: string[]
  values: Record<string, number>
}

export const DEFAULT_QUERY: QueryConfig = {
  mode: "crosstab",
  dataset_id: null,
  collection_id: null,
  rows: [],
  row_mode: "stacked",
  columns: [],
  col_mode: "stacked",
  breakdown: null,
  filters: [],
  measure: { type: "count", field_key: null, aggregation: null, display: "n" },
}

// ── Field type display config ──────────────────────────────────────────────
// Fixed semantic map: field_type value → badge colour (CSS var) + icon character.
// Colour vars are defined in lib/theme.ts alongside --field-type-* tokens.

export const FIELD_TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  categorical: { color: "var(--field-type-categorical)", icon: "◯" },
  multi_response: { color: "var(--field-type-multi-response)", icon: "⊕" },
  ordinal: { color: "var(--field-type-ordinal)", icon: "≡" },
  numeric: { color: "var(--field-type-numeric)", icon: "#" },
}

export interface AnalyticsResult {
  meta: {
    mode: string
    row_fields?: { field_key: string; display_name: string }[]
    col_fields?: { field_key: string; display_name: string }[]
    row_mode?: string
    col_mode?: string
    fields?: { field_key: string; display_name: string }[]
    breakdown?: { field_key: string; display_name: string } | null
    measure: MeasureSpec
    dataset_name?: string
    collection_name?: string
    base_n?: number
    level_labels?: Record<string, Record<string, string>>
  }
  rows: ResultRow[]
}
