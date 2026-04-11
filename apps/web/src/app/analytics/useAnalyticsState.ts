"use client"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import type { QueryConfig } from "./analytics-types"

const DEFAULT_QUERY: QueryConfig = {
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

export function useAnalyticsState() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const query: QueryConfig = (() => {
    const raw = searchParams.get("q")
    if (!raw) return DEFAULT_QUERY
    try {
      return { ...DEFAULT_QUERY, ...JSON.parse(decodeURIComponent(raw)) }
    } catch {
      return DEFAULT_QUERY
    }
  })()

  const setQuery = useCallback(
    (updater: QueryConfig | ((prev: QueryConfig) => QueryConfig)) => {
      const next = typeof updater === "function" ? updater(query) : updater
      const params = new URLSearchParams(searchParams.toString())
      params.set("q", encodeURIComponent(JSON.stringify(next)))
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [query, router, pathname, searchParams],
  )

  return { query, setQuery }
}
