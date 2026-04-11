import type { AnalyticsResult } from "./analytics-types"

interface Props {
  result: AnalyticsResult
}

export function AnalyticsTable({ result }: Props) {
  const { meta, rows } = result
  if (rows.length === 0) return <p className="p-4 text-sm text-muted-foreground">No data.</p>

  const colKeys = Object.keys(rows[0].values)
  const isTrend = meta.mode === "trend"
  const isNested = !isTrend && rows[0]?.key.length === 4

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {isNested ? (
              <>
                <th className="px-3 py-2 text-left font-medium">
                  {meta.row_fields?.[0]?.display_name ?? ""}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {meta.row_fields?.[1]?.display_name ?? ""}
                </th>
              </>
            ) : isTrend ? (
              <>
                <th className="px-3 py-2 text-left font-medium">Wave</th>
                <th className="px-3 py-2 text-left font-medium">Field</th>
                <th className="px-3 py-2 text-left font-medium">Level</th>
              </>
            ) : (
              <th className="px-3 py-2 text-left font-medium">
                {meta.row_fields?.[0]?.display_name ?? ""}
              </th>
            )}
            {colKeys.map((k) => (
              <th key={k} className="px-3 py-2 text-right font-medium">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isNewSection = i > 0 && !isNested && !isTrend && row.key[0] !== rows[i - 1].key[0]
            return (
              <tr
                key={row.key.join("||")}
                className={`border-b hover:bg-muted/30 ${isNewSection ? "border-t-2 border-t-border" : ""}`}
              >
                {isNested ? (
                  <>
                    <td className="px-3 py-1">{row.key[1]}</td>
                    <td className="px-3 py-1">{row.key[3]}</td>
                  </>
                ) : isTrend ? (
                  <>
                    <td className="px-3 py-1">{row.key[0]}</td>
                    <td className="px-3 py-1">{row.key[1]}</td>
                    <td className="px-3 py-1">{row.key[2]}</td>
                  </>
                ) : (
                  <td className="px-3 py-1">{row.key[1]}</td>
                )}
                {colKeys.map((k) => (
                  <td key={k} className="px-3 py-1 text-right tabular-nums">
                    {row.values[k]?.toFixed(1) ?? "—"}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
