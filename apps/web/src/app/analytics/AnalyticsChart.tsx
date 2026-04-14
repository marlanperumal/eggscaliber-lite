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

interface Props {
  result: AnalyticsResult
  chartType: ChartType
}

export function AnalyticsChart({ result, chartType }: Props) {
  const colors = useChartColors()
  const { rows } = result
  if (rows.length === 0) return null

  const allValueKeys = Object.keys(rows[0].values)
  const nonTotalKeys = allValueKeys.filter((k) => k !== "Total")
  // When no column variable is set, "Total" is the only key — use it as the single series
  const seriesKeys = nonTotalKeys.length > 0 ? nonTotalKeys : ["Total"]
  const isTrend = result.meta.mode === "trend"

  if (isTrend) {
    const datasets = [...new Set(rows.map((r) => r.key[0]))]
    const series = [...new Set(rows.map((r) => `${r.key[1]} — ${r.key[2]}`))]
    const chartData = datasets.map((ds) => {
      const entry: Record<string, string | number> = { name: ds }
      series.forEach((s) => {
        const row = rows.find((r) => r.key[0] === ds && `${r.key[1]} — ${r.key[2]}` === s)
        entry[s] = row?.values.Total ?? 0
      })
      return entry
    })
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
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

  const xKeys = [...new Set(rows.map((r) => r.key[1]))]
  const chartData = xKeys.map((xk) => {
    const entry: Record<string, string | number> = { name: xk }
    const row = rows.find((r) => r.key[1] === xk)
    seriesKeys.forEach((sk) => {
      entry[sk] = row?.values[sk] ?? 0
    })
    return entry
  })

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
        {seriesKeys.map((sk, i) => (
          <Bar key={sk} dataKey={sk} stackId={stackId} fill={colors[i % colors.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
