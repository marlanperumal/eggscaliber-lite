"use client"
import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { AnalyticsResult, ChartType } from "./analytics-types"

const CHART_COLOR_COUNT = 8

function useChartColors(): string[] {
  return useMemo(() => {
    const root = document.documentElement
    const style = getComputedStyle(root)
    return Array.from({ length: CHART_COLOR_COUNT }, (_, i) =>
      style.getPropertyValue(`--chart-${i + 1}`).trim(),
    )
  }, [])
}

function resolveLevel(
  fieldKey: string,
  levelCode: string,
  levelLabels: Record<string, Record<string, string>> | undefined,
): string {
  return levelLabels?.[fieldKey]?.[levelCode] ?? levelCode
}

function resolveColLabel(
  key: string,
  colFields: { field_key: string; display_name: string }[] | undefined,
  levelLabels: Record<string, Record<string, string>> | undefined,
): string {
  if (key === "Total") return "Total"
  if (colFields) {
    for (const cf of colFields) {
      const label = levelLabels?.[cf.field_key]?.[key]
      if (label !== undefined) return label
    }
  }
  return key
}

interface Props {
  result: AnalyticsResult
  chartType: ChartType
}

export function AnalyticsChart({ result, chartType }: Props) {
  const colors = useChartColors()
  const { rows, meta } = result
  if (rows.length === 0) return null

  const { level_labels } = meta
  const allValueKeys = Object.keys(rows[0].values)
  const nonTotalKeys = allValueKeys.filter((k) => k !== "Total")
  // When no column variable is set, "Total" is the only key — use it as the single series
  const seriesKeys = nonTotalKeys.length > 0 ? nonTotalKeys : ["Total"]
  const isTrend = meta.mode === "trend"

  if (isTrend) {
    const datasets = [...new Set(rows.map((r) => r.key[0]))]
    // Build human-readable series keys: "Field display — Level display"
    const rawSeries = [...new Set(rows.map((r) => `${r.key[1]}__${r.key[2]}`))]
    const seriesLabels: Record<string, string> = {}
    for (const raw of rawSeries) {
      const [fk, lv] = raw.split("__")
      const fieldName = meta.fields?.find((f) => f.field_key === fk)?.display_name ?? fk
      const levelName = resolveLevel(fk, lv, level_labels)
      seriesLabels[raw] = `${fieldName} — ${levelName}`
    }

    const chartData = datasets.map((ds) => {
      const entry: Record<string, string | number> = { name: ds }
      for (const raw of rawSeries) {
        const [fk, lv] = raw.split("__")
        const row = rows.find((r) => r.key[0] === ds && r.key[1] === fk && r.key[2] === lv)
        entry[seriesLabels[raw]] = row?.values.Total ?? 0
      }
      return entry
    })

    const labeledSeries = rawSeries.map((r) => seriesLabels[r])
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {labeledSeries.map((s, i) => (
            <Line
              key={s}
              type="monotone"
              dataKey={s}
              stroke={colors[i % colors.length]}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // Crosstab: key[0] = row field key, key[1] = row level code
  const rowFieldKey = meta.row_fields?.[0]?.field_key ?? ""
  const xKeys = [...new Set(rows.map((r) => r.key[1]))]
  const chartData = xKeys.map((xk) => {
    const row = rows.find((r) => r.key[1] === xk)
    const entry: Record<string, string | number> = {
      name: resolveLevel(rowFieldKey, xk, level_labels),
    }
    for (const sk of seriesKeys) {
      const label = resolveColLabel(sk, meta.col_fields, level_labels)
      entry[label] = row?.values[sk] ?? 0
    }
    return entry
  })
  const labeledSeriesKeys = seriesKeys.map((sk) =>
    resolveColLabel(sk, meta.col_fields, level_labels),
  )

  const stacked = chartType !== "grouped_bar"
  const stackId = stacked ? "stack" : undefined
  const normalized = chartType === "stacked_bar_100"

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis domain={normalized ? [0, 100] : undefined} />
        <Tooltip />
        <Legend />
        {labeledSeriesKeys.map((sk, i) => (
          <Bar key={sk} dataKey={sk} stackId={stackId} fill={colors[i % colors.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
