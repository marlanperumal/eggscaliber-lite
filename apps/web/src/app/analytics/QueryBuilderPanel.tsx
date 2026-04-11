"use client"
import { Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type {
  AnalyticsResult,
  DisplayType,
  FieldSelection,
  MeasureType,
  QueryConfig,
} from "./analytics-types"

interface Props {
  onCollapse: () => void
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => void
  onResult: (r: AnalyticsResult) => void
}

export function QueryBuilderPanel({ onCollapse, query, onQueryChange, onResult }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = query ?? emptyQuery()
  const set = (patch: Partial<QueryConfig>) => onQueryChange({ ...q, ...patch })

  const removeRow = (fk: string) => set({ rows: q.rows.filter((r) => r.field_key !== fk) })
  const removeCol = (fk: string) => set({ columns: q.columns.filter((c) => c.field_key !== fk) })
  const removeFilter = (fk: string) => set({ filters: q.filters.filter((f) => f.field_key !== fk) })

  const run = async () => {
    if (q.mode === "crosstab" && !q.dataset_id) {
      setError("Select a dataset first")
      return
    }
    if (q.mode === "trend" && !q.collection_id) {
      setError("Select a collection first")
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (q.mode === "crosstab") {
        const { data, error: apiError } = await api.POST("/api/v1/analytics/crosstab", {
          body: {
            dataset_id: q.dataset_id as number,
            rows: q.rows,
            row_mode: q.row_mode,
            columns: q.columns,
            col_mode: q.col_mode,
            // biome-ignore lint/suspicious/noExplicitAny: API body types differ slightly from local types
            filters: q.filters as unknown as any,
            // biome-ignore lint/suspicious/noExplicitAny: API body types differ slightly from local types
            measure: q.measure as unknown as any,
          },
        })
        if (apiError) throw new Error(JSON.stringify(apiError))
        onResult(data as AnalyticsResult)
      } else {
        const { data, error: apiError } = await api.POST("/api/v1/analytics/trend", {
          body: {
            collection_id: q.collection_id as number,
            fields: q.rows,
            breakdown: q.breakdown ?? undefined,
            // biome-ignore lint/suspicious/noExplicitAny: API body types differ slightly from local types
            filters: q.filters as unknown as any,
            // biome-ignore lint/suspicious/noExplicitAny: API body types differ slightly from local types
            measure: q.measure as unknown as any,
          },
        })
        if (apiError) throw new Error(JSON.stringify(apiError))
        onResult(data as AnalyticsResult)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Query Builder</span>
        <button
          type="button"
          onClick={onCollapse}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {/* Mode tabs */}
        <div className="flex gap-1 rounded border p-0.5">
          {(["crosstab", "trend"] as const).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => set({ mode: m })}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                q.mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {m === "crosstab" ? "Cross-tab" : "Trending"}
            </button>
          ))}
        </div>

        {/* Scope picker */}
        <ScopePicker query={q} onSet={set} />

        {/* Rows / Fields zone */}
        <Zone
          label={q.mode === "trend" ? "Fields" : "Rows"}
          fields={q.rows}
          onRemove={removeRow}
          mode={q.row_mode}
          onModeChange={(m) => set({ row_mode: m })}
          showModeSelector={q.rows.length >= 2 && q.mode === "crosstab"}
        />

        {/* Columns zone (crosstab only) */}
        {q.mode === "crosstab" && (
          <Zone
            label="Columns"
            fields={q.columns}
            onRemove={removeCol}
            mode={q.col_mode}
            onModeChange={(m) => set({ col_mode: m })}
            showModeSelector={q.columns.length >= 2}
          />
        )}

        {/* Breakdown (trend only) */}
        {q.mode === "trend" && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Break down by
            </p>
            {q.breakdown ? (
              <div className="mt-1 flex items-center gap-1 rounded border px-2 py-1">
                <span className="flex-1 text-sm">{q.breakdown.field_key}</span>
                <button type="button" onClick={() => set({ breakdown: null })}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Click a field in the field tree to add it here.
              </p>
            )}
          </div>
        )}

        {/* Filters */}
        {q.filters.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Filters
            </p>
            <div className="mt-1 space-y-1">
              {q.filters.map((f) => (
                <div key={f.field_key} className="flex items-center gap-1 rounded border px-2 py-1">
                  <span className="flex-1 text-sm">{f.display_name ?? f.field_key}</span>
                  {f.levels && (
                    <span className="text-xs text-muted-foreground">{f.levels.join(", ")}</span>
                  )}
                  <button type="button" onClick={() => removeFilter(f.field_key)}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Measure */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Measure
          </p>
          <div className="mt-1 flex gap-1 rounded border p-0.5">
            {(["count", "weighted", "value_field"] as MeasureType[]).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => set({ measure: { ...q.measure, type: t } })}
                className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                  q.measure.type === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {t === "count" ? "Count" : t === "weighted" ? "Weighted" : "Value"}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1 rounded border p-0.5">
            {(["n", "pct_col", "pct_row"] as DisplayType[]).map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => set({ measure: { ...q.measure, display: d } })}
                className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                  q.measure.display === d
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {d === "n" ? "N" : d === "pct_col" ? "% Col" : "% Row"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t p-3">
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>
    </div>
  )
}

function Zone({
  label,
  fields,
  onRemove,
  mode,
  onModeChange,
  showModeSelector,
}: {
  label: string
  fields: FieldSelection[]
  onRemove: (fk: string) => void
  mode: "stacked" | "nested"
  onModeChange: (m: "stacked" | "nested") => void
  showModeSelector: boolean
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 min-h-[40px] space-y-1 rounded border p-1">
        {fields.length === 0 && (
          <p className="px-1 py-1 text-xs text-muted-foreground">
            Click fields in the field tree to add them here.
          </p>
        )}
        {fields.map((f) => (
          <div key={f.field_key} className="flex items-center gap-1 rounded bg-muted/50 px-2 py-1">
            <span className="flex-1 text-xs">{f.display_name ?? f.field_key}</span>
            <button type="button" onClick={() => onRemove(f.field_key)}>
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {showModeSelector && (
        <div className="mt-1 flex gap-1">
          {(["stacked", "nested"] as const).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => onModeChange(m)}
              className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                mode === m ? "bg-muted font-medium" : "hover:bg-muted/50"
              }`}
            >
              {m === "stacked" ? "Stacked ↕" : "Nested →"}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface PackageOption {
  id: number
  name: string
  collections: { id: number; name: string; datasets: { id: number; name: string }[] }[]
}

function ScopePicker({
  query,
  onSet,
}: {
  query: QueryConfig
  onSet: (patch: Partial<QueryConfig>) => void
}) {
  const [packages, setPackages] = useState<PackageOption[]>([])

  useEffect(() => {
    api.GET("/api/v1/packages").then(async ({ data }) => {
      if (!data) return
      const withDetails = await Promise.all(
        (data as { id: number; name: string }[]).map(async (pkg) => {
          const { data: pkgData } = await api.GET("/api/v1/packages/{package_id}", {
            params: { path: { package_id: pkg.id } },
          })
          if (!pkgData) return null
          const withDatasets = await Promise.all(
            ((pkgData as { collections?: { id: number; name: string }[] }).collections ?? []).map(
              async (col) => {
                const { data: colData } = await api.GET("/api/v1/collections/{collection_id}", {
                  params: { path: { collection_id: col.id } },
                })
                const datasets =
                  (
                    colData as {
                      datasets?: { id: number; name: string }[]
                    } | null
                  )?.datasets ?? []
                return { id: col.id, name: col.name, datasets }
              },
            ),
          )
          return { id: pkg.id, name: pkg.name, collections: withDatasets }
        }),
      )
      setPackages(withDetails.filter(Boolean) as PackageOption[])
    })
  }, [])

  if (query.mode === "crosstab") {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dataset</p>
        <select
          className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
          value={query.dataset_id ?? ""}
          onChange={(e) => onSet({ dataset_id: Number(e.target.value) || null })}
        >
          <option value="">Select dataset…</option>
          {packages.map((pkg) =>
            pkg.collections.map((col) =>
              col.datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {pkg.name} › {col.name} › {ds.name}
                </option>
              )),
            ),
          )}
        </select>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Collection
      </p>
      <select
        className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
        value={query.collection_id ?? ""}
        onChange={(e) => onSet({ collection_id: Number(e.target.value) || null })}
      >
        <option value="">Select collection…</option>
        {packages.map((pkg) =>
          pkg.collections.map((col) => (
            <option key={col.id} value={col.id}>
              {pkg.name} › {col.name}
            </option>
          )),
        )}
      </select>
    </div>
  )
}

function emptyQuery(): QueryConfig {
  return {
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
}
