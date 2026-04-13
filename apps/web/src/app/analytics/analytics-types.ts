export type AnalysisMode = "crosstab" | "trend"
export type RowColMode = "stacked" | "nested"
export type MeasureType = "count" | "weighted" | "value_field"
export type DisplayType = "n" | "pct_col" | "pct_row"
export type ChartType = "grouped_bar" | "stacked_bar" | "stacked_bar_100" | "line"
export type ViewMode = "chart_only" | "table_only" | "stacked" | "side_by_side"

export interface FieldSelection {
  field_key: string
  display_name?: string
}

export interface FilterSpec {
  field_key: string
  display_name?: string
  levels?: string[]
  value_range?: [number, number]
}

export interface MeasureSpec {
  type: MeasureType
  field_key: string | null
  aggregation: "sum" | "mean" | null
  display: DisplayType
}

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
  }
  rows: ResultRow[]
}
