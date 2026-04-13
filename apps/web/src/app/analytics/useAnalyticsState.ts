"use client"
import {
  parseAsArrayOf,
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
  rows: parseAsArrayOf(parseAsString).withDefault([]),
  row_mode: parseAsStringLiteral(ROW_COL_MODES).withDefault("stacked"),
  cols: parseAsArrayOf(parseAsString).withDefault([]),
  col_mode: parseAsStringLiteral(ROW_COL_MODES).withDefault("stacked"),
  bd: parseAsString,
  filters: parseAsJson<FilterSpec[]>().withDefault([]),
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
    rows: p.rows.map((fk) => ({ field_key: fk })),
    row_mode: p.row_mode,
    columns: p.cols.map((fk) => ({ field_key: fk })),
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
        rows: next.rows.map((f) => f.field_key),
        row_mode: next.row_mode,
        cols: next.columns.map((f) => f.field_key),
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
