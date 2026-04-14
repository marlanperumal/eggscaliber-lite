"use client"
import { useState } from "react"
import { AnalyticsChart } from "./AnalyticsChart"
import { AnalyticsTable } from "./AnalyticsTable"
import type { AnalyticsResult, ChartType, QueryConfig, ViewMode } from "./analytics-types"

interface Props {
  result: AnalyticsResult | null
  query: QueryConfig | null
}

export function ResultsPanel({ result, query }: Props) {
  const [chartType, setChartType] = useState<ChartType>("grouped_bar")
  const [viewMode, setViewMode] = useState<ViewMode>("stacked")

  const isTrend = query?.mode === "trend"

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Configure a query and press Run.</p>
      </div>
    )
  }

  const showChart = viewMode !== "table_only"
  const showTable = viewMode !== "chart_only"

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
        <div>
          <p className="text-sm font-medium">
            {result.meta.dataset_name ?? result.meta.collection_name}
          </p>
          <p className="text-xs text-muted-foreground">
            n = {result.meta.base_n ?? "—"} · {result.meta.measure.type} ·{" "}
            {result.meta.measure.display}
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
