"use client"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalyticsChart } from "./AnalyticsChart"
import { AnalyticsTable } from "./AnalyticsTable"
import type { AnalyticsResult, ChartType, QueryConfig, ViewMode } from "./analytics-types"
import { EmptyState } from "./EmptyState"
import { ResultsIllustration } from "./illustrations/ResultsIllustration"

const MEASURE_TYPE_LABELS: Record<string, string> = {
  count: "Count",
  weighted: "Weighted",
  value_field: "Value",
}

const DISPLAY_LABELS: Record<string, string> = {
  n: "N",
  pct_col: "% of column",
  pct_row: "% of row",
}

interface Props {
  result: AnalyticsResult | null
  query: QueryConfig | null
  lastRunQuery: QueryConfig | null
  isLoading: boolean
}

function PanelSpinner() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60"
    />
  )
}

export function ResultsPanel({ result, query, lastRunQuery, isLoading }: Props) {
  const [chartType, setChartType] = useState<ChartType>("grouped_bar")
  const [viewMode, setViewMode] = useState<ViewMode>("stacked")

  if (isLoading) {
    return (
      <div data-testid="results-panel" className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2">
          <PanelSpinner />
          <p className="text-sm text-muted-foreground">Running…</p>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-end gap-2">
            <Skeleton className="h-20 w-8" />
            <Skeleton className="h-28 w-8" />
            <Skeleton className="h-16 w-8" />
            <Skeleton className="h-24 w-8" />
            <Skeleton className="h-20 w-8" />
            <Skeleton className="h-14 w-8" />
          </div>
          <Skeleton className="h-3 w-[90%]" />
          <Skeleton className="h-3 w-[80%]" />
          <Skeleton className="h-3 w-[85%]" />
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div data-testid="results-panel" className="flex h-full flex-col">
        <EmptyState
          illustration={<ResultsIllustration />}
          title="No results yet"
          body="Configure a query and press Run"
        />
      </div>
    )
  }

  const isTrend = query?.mode === "trend"

  const isStale =
    !!result && !!query && !!lastRunQuery && JSON.stringify(query) !== JSON.stringify(lastRunQuery)

  const showChart = viewMode !== "table_only"
  const showTable = viewMode !== "chart_only"
  const measureLabel = MEASURE_TYPE_LABELS[result.meta.measure.type] ?? result.meta.measure.type
  const displayLabel = DISPLAY_LABELS[result.meta.measure.display] ?? result.meta.measure.display

  return (
    <div data-testid="results-panel" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
        <div>
          <p className="text-sm font-medium">
            {result.meta.dataset_name ?? result.meta.collection_name}
            {isStale && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (stale — re-run to update)
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            n = {result.meta.base_n ?? "—"} · {measureLabel} · {displayLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(
              [
                ["grouped_bar", "Grouped"],
                ["stacked_bar", "Stacked"],
                ["stacked_bar_100", "100%"],
                ["line", "Line"],
              ] as [ChartType, string][]
            ).map(([ct, label]) => (
              <button
                type="button"
                key={ct}
                disabled={ct === "line" && !isTrend}
                onClick={() => setChartType(ct)}
                title={label}
                className={`rounded border px-2 py-1 text-xs transition-colors disabled:opacity-30 ${
                  chartType === ct ? "bg-muted font-medium" : "hover:bg-muted/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-1">
            {(
              [
                ["chart_only", "Chart"],
                ["stacked", "Both"],
                ["table_only", "Table"],
              ] as [ViewMode, string][]
            ).map(([vm, label]) => (
              <button
                type="button"
                key={vm}
                onClick={() => setViewMode(vm)}
                className={`rounded border px-2 py-1 text-xs transition-colors ${
                  viewMode === vm ? "bg-muted font-medium" : "hover:bg-muted/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`flex flex-1 overflow-hidden ${viewMode === "side_by_side" ? "flex-row" : "flex-col"}`}
      >
        {showChart && (
          <div
            className={`p-4 ${viewMode === "stacked" ? "border-b border-border" : "flex-1 border-r border-border"}`}
          >
            <AnalyticsChart result={result} chartType={chartType} />
          </div>
        )}
        {showTable && (
          <div className="flex-1 overflow-auto">
            <AnalyticsTable result={result} />
          </div>
        )}
      </div>
    </div>
  )
}
