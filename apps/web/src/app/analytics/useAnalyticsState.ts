"use client"
import {
  parseAsInteger,
  parseAsJson,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { useCallback, useRef } from "react"
import type { FilterSpec, QueryConfig } from "./analytics-types"

const MODES = ["crosstab", "trend"] as const
const ROW_COL_MODES = ["stacked", "nested"] as const
const MEASURE_TYPES = ["count", "weighted", "value_field"] as const
const DISPLAY_TYPES = ["n", "pct_col", "pct_row"] as const
const AGGREGATIONS = ["sum", "mean"] as const

const analyticsParams = {
  mode: parseAsStringLiteral(MODES).withDefault("crosstab"),
  ds: parseAsInteger,
  col: parseAsInteger,
  // Store full FieldSelection objects (not just field_key strings) so that
  // display_name survives URL round-trips and chips always show human labels.
  rows: parseAsJson<FilterSpec[]>((v) => v as FilterSpec[]).withDefault([]),
  row_mode: parseAsStringLiteral(ROW_COL_MODES).withDefault("stacked"),
  cols: parseAsJson<FilterSpec[]>((v) => v as FilterSpec[]).withDefault([]),
  col_mode: parseAsStringLiteral(ROW_COL_MODES).withDefault("stacked"),
  bd: parseAsString,
  filters: parseAsJson<FilterSpec[]>((v) => v as FilterSpec[]).withDefault([]),
  mt: parseAsStringLiteral(MEASURE_TYPES).withDefault("count"),
  md: parseAsStringLiteral(DISPLAY_TYPES).withDefault("n"),
  mf: parseAsString,
  ma: parseAsStringLiteral(AGGREGATIONS),
}

export function useAnalyticsState() {
  const [p, setP] = useQueryStates(analyticsParams, { history: "replace", scroll: false })

  const query: QueryConfig = {
    mode: p.mode,
    dataset_id: p.ds,
    collection_id: p.col,
    rows: p.rows as QueryConfig["rows"],
    row_mode: p.row_mode,
    columns: p.cols as QueryConfig["columns"],
    col_mode: p.col_mode,
    breakdown: p.bd ? { field_key: p.bd } : null,
    filters: p.filters,
    measure: {
      type: p.mt,
      field_key: p.mf,
      aggregation: p.ma,
      display: p.md,
    },
  }

  const queryRef = useRef(query)
  queryRef.current = query

  const setQuery = useCallback(
    (updater: QueryConfig | ((prev: QueryConfig) => QueryConfig)) => {
      const next = typeof updater === "function" ? updater(queryRef.current) : updater
      setP({
        mode: next.mode,
        ds: next.dataset_id,
        col: next.collection_id,
        rows: next.rows as FilterSpec[],
        row_mode: next.row_mode,
        cols: next.columns as FilterSpec[],
        col_mode: next.col_mode,
        bd: next.breakdown?.field_key ?? null,
        filters: next.filters,
        mt: next.measure.type,
        md: next.measure.display,
        mf: next.measure.field_key,
        ma: next.measure.aggregation,
      })
    },
    [setP],
  )

  return { query, setQuery }
}
