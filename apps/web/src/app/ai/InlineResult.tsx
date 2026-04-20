"use client"
import Link from "next/link"
import type { AnalyticsResult } from "@/app/analytics/analytics-types"
import { AnalyticsChart } from "@/components/analytics/AnalyticsChart"
import type { AICrosstabResultPart, AITrendResultPart } from "./ai-types"

type ResultPart = AICrosstabResultPart | AITrendResultPart

interface Props {
  part: ResultPart
}

export function buildAnalyticsUrl(
  queryConfig: Record<string, unknown>,
  type: "crosstab" | "trend",
): string {
  const params = new URLSearchParams()
  params.set("mode", type)

  if (type === "crosstab") {
    const ds = queryConfig.dataset_id as number | undefined
    if (ds) params.set("ds", String(ds))
    const rows = queryConfig.rows as unknown[] | undefined
    if (rows?.length) params.set("rows", JSON.stringify(rows))
    const cols = queryConfig.columns as unknown[] | undefined
    if (cols?.length) params.set("cols", JSON.stringify(cols))
    const rowMode = queryConfig.row_mode as string | undefined
    if (rowMode && rowMode !== "stacked") params.set("row_mode", rowMode)
    const colMode = queryConfig.col_mode as string | undefined
    if (colMode && colMode !== "stacked") params.set("col_mode", colMode)
  } else {
    const col = queryConfig.collection_id as number | undefined
    if (col) params.set("col", String(col))
    const fields = queryConfig.fields as unknown[] | undefined
    if (fields?.length) params.set("rows", JSON.stringify(fields))
    const bd = queryConfig.breakdown as { field_key: string } | null | undefined
    if (bd) params.set("bd", bd.field_key)
  }

  const measure = queryConfig.measure as Record<string, unknown> | undefined
  if (measure) {
    params.set("mt", String(measure.type ?? "count"))
    params.set("md", String(measure.display ?? "n"))
    if (measure.field_key) params.set("mf", String(measure.field_key))
    if (measure.aggregation) params.set("ma", String(measure.aggregation))
  }

  return `/analytics?${params.toString()}`
}

export function InlineResult({ part }: Props) {
  const result = part.data as unknown as AnalyticsResult
  const type = part.type === "crosstab_result" ? "crosstab" : "trend"
  const chartType = type === "trend" ? "line" : "grouped_bar"
  const analyticsUrl = buildAnalyticsUrl(part.query_config, type)

  return (
    <div
      data-testid="inline-result"
      className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
    >
      <div className="text-muted-foreground text-xs">
        {type === "crosstab"
          ? `${result.meta.dataset_name ?? "Dataset"} — ${result.meta.base_n ?? 0} respondents`
          : `${result.meta.collection_name ?? "Collection"} — ${result.meta.base_n ?? 0} respondents`}
      </div>
      <div className="h-48">
        <AnalyticsChart result={result} chartType={chartType} />
      </div>
      <Link
        href={analyticsUrl}
        className="self-start text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
      >
        Open in Analytics →
      </Link>
    </div>
  )
}
