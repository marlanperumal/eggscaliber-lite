"use client"
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

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#84cc16",
]

interface Props {
  result: AnalyticsResult
  chartType: ChartType
}

export function AnalyticsChart({ result, chartType }: Props) {
  const { rows } = result
  if (rows.length === 0) return null

  const seriesKeys = Object.keys(rows[0].values).filter((k) => k !== "Total")
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
              stroke={COLORS[i % COLORS.length]}
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
          <Bar key={sk} dataKey={sk} stackId={stackId} fill={COLORS[i % COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
