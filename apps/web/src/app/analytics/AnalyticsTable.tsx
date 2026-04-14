import type { AnalyticsResult } from "./analytics-types"

interface Props {
  result: AnalyticsResult
}

function levelLabel(
  fieldKey: string,
  levelCode: string,
  levelLabels: Record<string, Record<string, string>> | undefined,
): string {
  return levelLabels?.[fieldKey]?.[levelCode] ?? levelCode
}

function fieldLabel(
  fieldKey: string,
  fields: { field_key: string; display_name: string }[] | undefined,
): string {
  return fields?.find((f) => f.field_key === fieldKey)?.display_name ?? fieldKey
}

function colHeader(
  key: string,
  colFields: { field_key: string; display_name: string }[] | undefined,
  levelLabels: Record<string, Record<string, string>> | undefined,
): string {
  if (key === "Total") return "Total"
  // Search col_fields in order; first match wins
  if (colFields) {
    for (const cf of colFields) {
      const label = levelLabels?.[cf.field_key]?.[key]
      if (label !== undefined) return label
    }
  }
  return key
}

export function AnalyticsTable({ result }: Props) {
  const { meta, rows } = result
  if (rows.length === 0) return <p className="p-4 text-sm text-muted-foreground">No data.</p>

  const colKeys = Object.keys(rows[0].values)
  const isTrend = meta.mode === "trend"
  const isNested = !isTrend && rows[0]?.key.length === 4
  const { level_labels } = meta

  // Stacked multi-field header: show all row field names
  const rowHeader = isTrend
    ? null
    : isNested
      ? null
      : meta.row_fields && meta.row_fields.length > 1
        ? meta.row_fields.map((f) => f.display_name).join(" / ")
        : (meta.row_fields?.[0]?.display_name ?? "")

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
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
              <th className="px-3 py-2 text-left font-medium">{rowHeader}</th>
            )}
            {colKeys.map((k) => (
              <th key={k} className="px-3 py-2 text-right font-medium">
                {colHeader(k, meta.col_fields, level_labels)}
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
                className={`border-b border-border hover:bg-muted/30 ${isNewSection ? "border-t-2 border-t-border" : ""}`}
              >
                {isNested ? (
                  <>
                    <td className="px-3 py-1">
                      {levelLabel(row.key[0], row.key[1], level_labels)}
                    </td>
                    <td className="px-3 py-1">
                      {levelLabel(row.key[2], row.key[3], level_labels)}
                    </td>
                  </>
                ) : isTrend ? (
                  <>
                    <td className="px-3 py-1">{row.key[0]}</td>
                    <td className="px-3 py-1">{fieldLabel(row.key[1], meta.fields)}</td>
                    <td className="px-3 py-1">
                      {levelLabel(row.key[1], row.key[2], level_labels)}
                    </td>
                  </>
                ) : (
                  <td className="px-3 py-1">{levelLabel(row.key[0], row.key[1], level_labels)}</td>
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
