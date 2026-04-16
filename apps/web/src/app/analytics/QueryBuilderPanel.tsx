"use client"
import { useDndMonitor, useDroppable } from "@dnd-kit/core"
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { components } from "@shared/api"
import { Play, X } from "lucide-react"
import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type {
  AnalyticsResult,
  DisplayType,
  FieldSelection,
  FilterSpec,
  MeasureSpec,
  MeasureType,
  QueryConfig,
} from "./analytics-types"
import { DEFAULT_QUERY, FIELD_TYPE_CONFIG } from "./analytics-types"
import { QueryZoneIllustration } from "./illustrations/QueryZoneIllustration"

// ── Measure matrix config ──────────────────────────────────────────────────

const MEASURE_TYPES: { value: MeasureType; label: string; ariaLabel: string }[] = [
  { value: "count", label: "Count", ariaLabel: "Count" },
  { value: "weighted", label: "Wtd", ariaLabel: "Weighted" },
  { value: "value_field", label: "Value", ariaLabel: "Value" },
]

const DISPLAY_TYPES: { value: DisplayType; label: string }[] = [
  { value: "n", label: "N" },
  { value: "pct_col", label: "% Col" },
  { value: "pct_row", label: "% Row" },
]

// ── Mode config ────────────────────────────────────────────────────────────

const MODE_CONFIG = [
  { value: "crosstab" as const, icon: "⊞", label: "Cross-tab", desc: "Compare groups" },
  { value: "trend" as const, icon: "📈", label: "Trending", desc: "Track over time" },
]

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  onCollapse: () => void
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => void
  onResult: (r: AnalyticsResult, q: QueryConfig) => void
  isLoading: boolean
  onLoadingChange: (loading: boolean) => void
}

// ── Main component ─────────────────────────────────────────────────────────

export function QueryBuilderPanel({
  onCollapse,
  query,
  onQueryChange,
  onResult,
  isLoading,
  onLoadingChange,
}: Props) {
  const [error, setError] = useState<string | null>(null)

  const q = query ?? DEFAULT_QUERY
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
    onLoadingChange(true)
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
            filters: q.filters.map(({ display_name: _dn, ...rest }) => rest),
            measure: q.measure,
          },
        })
        if (apiError) throw new Error(JSON.stringify(apiError))
        onResult(data as AnalyticsResult, q)
      } else {
        const { data, error: apiError } = await api.POST("/api/v1/analytics/trend", {
          body: {
            collection_id: q.collection_id as number,
            fields: q.rows,
            breakdown: q.breakdown ?? undefined,
            filters: q.filters.map(({ display_name: _dn, ...rest }) => rest),
            measure: q.measure,
          },
        })
        if (apiError) throw new Error(JSON.stringify(apiError))
        onResult(data as AnalyticsResult, q)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed")
    } finally {
      onLoadingChange(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between border-border border-b bg-muted/50 px-3 py-2">
        <span className="font-medium text-sm">Query Builder</span>
        <button
          type="button"
          onClick={onCollapse}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* Mode mini-cards */}
        <div className="grid grid-cols-2 gap-1.5">
          {MODE_CONFIG.map(({ value, icon, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => set({ mode: value })}
              className={cn(
                "flex flex-col items-center rounded-lg border-2 p-2 text-center transition-colors",
                q.mode === value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/50",
              )}
            >
              <span className="mb-0.5 text-lg leading-none">{icon}</span>
              <span className="font-semibold text-xs">{label}</span>
              <span className="mt-0.5 text-[9px] text-muted-foreground leading-tight">{desc}</span>
            </button>
          ))}
        </div>

        {/* Scope picker */}
        <ScopePicker query={q} onSet={set} />

        {/* Rows / Fields zone */}
        <Zone
          label={q.mode === "trend" ? "Fields" : "Rows"}
          zoneId="zone-rows"
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
            zoneId="zone-columns"
            fields={q.columns}
            onRemove={removeCol}
            mode={q.col_mode}
            onModeChange={(m) => set({ col_mode: m })}
            showModeSelector={q.columns.length >= 2}
          />
        )}

        {/* Breakdown (trend only) */}
        {q.mode === "trend" && (
          <BreakdownZone breakdown={q.breakdown} onRemove={() => set({ breakdown: null })} />
        )}

        {/* Filters */}
        {q.filters.length > 0 && (
          <div>
            <p className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
              Filters
            </p>
            <div className="flex flex-wrap gap-1">
              {q.filters.map((f) => (
                <FilterChip key={f.field_key} filter={f} onRemove={removeFilter} />
              ))}
            </div>
          </div>
        )}

        {/* Measure matrix */}
        <MeasureMatrix measure={q.measure} onSet={set} />
      </div>

      {/* Run button */}
      <div className="border-border border-t p-3">
        {error && <p className="mb-2 text-destructive text-xs">{error}</p>}
        <button
          type="button"
          onClick={run}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Play className="h-3 w-3" aria-hidden />
          {isLoading ? "Running…" : "Run Query"}
        </button>
      </div>
    </div>
  )
}

// ── FieldChip ──────────────────────────────────────────────────────────────

function FieldChip({ field, onRemove }: { field: FieldSelection; onRemove: (fk: string) => void }) {
  const typeConfig = field.field_type ? FIELD_TYPE_CONFIG[field.field_type] : null
  return (
    <div
      data-testid={`field-chip-${field.field_key}`}
      className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary"
    >
      {typeConfig ? (
        <span
          className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full font-black text-[8px] text-primary-foreground"
          style={{ background: typeConfig.color }}
        >
          {typeConfig.icon}
        </span>
      ) : (
        <span className="h-[18px] w-[18px] flex-shrink-0 rounded-full bg-muted" />
      )}
      <span>{field.display_name ?? field.field_key}</span>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(field.field_key)}
        className="ml-0.5 text-primary/60 hover:text-primary"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

// ── SortableFieldChip ─────────────────────────────────────────────────────

function SortableFieldChip({
  field,
  zone,
  onRemove,
}: {
  field: FieldSelection
  zone: "rows" | "columns"
  onRemove: (fk: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `chip-${zone}-${field.field_key}`,
    data: {
      type: "chip",
      field_key: field.field_key,
      display_name: field.display_name,
      field_type: field.field_type,
      sourceZone: zone,
    },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <FieldChip field={field} onRemove={onRemove} />
    </div>
  )
}

// ── FilterChip ─────────────────────────────────────────────────────────────

function FilterChip({ filter, onRemove }: { filter: FilterSpec; onRemove: (fk: string) => void }) {
  return (
    <div
      data-testid={`field-chip-${filter.field_key}`}
      className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary"
    >
      <span>{filter.display_name ?? filter.field_key}</span>
      {filter.levels && <span className="text-primary/60">{filter.levels.join(", ")}</span>}
      <button
        type="button"
        onClick={() => onRemove(filter.field_key)}
        className="ml-0.5 text-primary/60 hover:text-primary"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

// ── Zone ───────────────────────────────────────────────────────────────────

function Zone({
  label,
  zoneId,
  fields,
  onRemove,
  mode,
  onModeChange,
  showModeSelector,
}: {
  label: string
  zoneId: "zone-rows" | "zone-columns"
  fields: FieldSelection[]
  onRemove: (fk: string) => void
  mode: "stacked" | "nested"
  onModeChange: (m: "stacked" | "nested") => void
  showModeSelector: boolean
}) {
  const [isDragActive, setIsDragActive] = useState(false)
  useDndMonitor({
    onDragStart: () => setIsDragActive(true),
    onDragEnd: () => setIsDragActive(false),
    onDragCancel: () => setIsDragActive(false),
  })

  const { setNodeRef, isOver } = useDroppable({ id: zoneId })
  const isEmpty = fields.length === 0
  const zoneName = zoneId === "zone-rows" ? "rows" : "columns"
  const sortableIds = fields.map((f) => `chip-${zoneName}-${f.field_key}`)

  return (
    <div>
      <p className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[52px] rounded-lg border p-1.5 transition-[box-shadow,background-color]",
          isDragActive &&
            !isOver &&
            "bg-primary/[0.07] shadow-[0_0_0_4px_hsl(var(--primary)/0.14),0_0_12px_hsl(var(--primary)/0.18)]",
          isOver &&
            "border-2 border-primary bg-primary/[0.07] shadow-[0_0_0_4px_hsl(var(--primary)/0.14),0_0_12px_hsl(var(--primary)/0.18)]",
          !isDragActive &&
            (isEmpty ? "border-border border-dashed bg-muted/30" : "border-border bg-card"),
        )}
      >
        {showModeSelector && (
          <div className="mb-1.5 flex justify-end border-border/50 border-b pb-1.5">
            <div className="flex overflow-hidden rounded-full border border-border">
              {(["stacked", "nested"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onModeChange(m)}
                  className={cn(
                    "px-2 py-0.5 font-semibold text-[10px] transition-colors",
                    mode === m
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {m === "stacked" ? "Stacked ↕" : "Nested →"}
                </button>
              ))}
            </div>
          </div>
        )}
        {isEmpty && !isDragActive ? (
          <div className="flex flex-col items-center gap-1 py-1">
            <QueryZoneIllustration />
            <p className="text-[9px] text-muted-foreground">Drag fields here or use R/C buttons</p>
          </div>
        ) : (
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-wrap gap-1">
              {fields.map((f) => (
                <SortableFieldChip
                  key={f.field_key}
                  field={f}
                  zone={zoneName}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  )
}

// ── BreakdownZone ─────────────────────────────────────────────────────────

function BreakdownZone({
  breakdown,
  onRemove,
}: {
  breakdown: FieldSelection | null
  onRemove: () => void
}) {
  const [isDragActive, setIsDragActive] = useState(false)
  useDndMonitor({
    onDragStart: () => setIsDragActive(true),
    onDragEnd: () => setIsDragActive(false),
    onDragCancel: () => setIsDragActive(false),
  })
  const { setNodeRef, isOver } = useDroppable({ id: "zone-breakdown" })

  return (
    <div>
      <p className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
        Break down by
      </p>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[32px] rounded-lg border p-1.5 transition-[box-shadow,background-color]",
          isDragActive &&
            !isOver &&
            "bg-primary/[0.07] shadow-[0_0_0_4px_hsl(var(--primary)/0.14),0_0_12px_hsl(var(--primary)/0.18)]",
          isOver &&
            "border-2 border-primary bg-primary/[0.07] shadow-[0_0_0_4px_hsl(var(--primary)/0.14),0_0_12px_hsl(var(--primary)/0.18)]",
          !isDragActive && "border-border bg-card",
        )}
      >
        {breakdown ? (
          <div
            data-testid={`field-chip-${breakdown.field_key}`}
            className="flex w-fit items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary"
          >
            <span>{breakdown.display_name ?? breakdown.field_key}</span>
            <button type="button" onClick={onRemove} className="text-primary/60 hover:text-primary">
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : (
          <p className="text-[9px] text-muted-foreground">Drag a field here or use the B button</p>
        )}
      </div>
    </div>
  )
}

// ── MeasureMatrix ──────────────────────────────────────────────────────────

function MeasureMatrix({
  measure,
  onSet,
}: {
  measure: MeasureSpec
  onSet: (patch: Partial<QueryConfig>) => void
}) {
  return (
    <div>
      <p className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
        Measure
      </p>
      <div className="overflow-hidden rounded-md border border-border text-[10px]">
        {/* Column headers */}
        <div className="grid grid-cols-[44px_1fr_1fr_1fr] border-border border-b bg-muted/50">
          <div className="border-border border-r" />
          {MEASURE_TYPES.map(({ value, label }) => (
            <div
              key={value}
              className="border-border border-r py-1 text-center font-semibold text-[9px] text-muted-foreground last:border-r-0"
            >
              {label}
            </div>
          ))}
        </div>
        {/* Data rows */}
        {DISPLAY_TYPES.map(({ value: display, label: displayLabel }) => (
          <div
            key={display}
            className="grid grid-cols-[44px_1fr_1fr_1fr] border-border border-b last:border-b-0"
          >
            <div className="flex items-center border-border border-r bg-muted/50 px-1.5 py-1 font-semibold text-[9px] text-muted-foreground">
              {displayLabel}
            </div>
            {MEASURE_TYPES.map(({ value: type, ariaLabel: typeAriaLabel }) => {
              const isActive = measure.type === type && measure.display === display
              return (
                <button
                  key={type}
                  type="button"
                  aria-label={`${typeAriaLabel}, ${displayLabel}`}
                  onClick={() => onSet({ measure: { ...measure, type, display } })}
                  className={cn(
                    "border-border border-r py-1 text-center transition-colors last:border-r-0",
                    isActive
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {isActive ? "✓" : "·"}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ScopePicker ────────────────────────────────────────────────────────────

type ScopePackage = components["schemas"]["ScopePackage"]

function ScopePicker({
  query,
  onSet,
}: {
  query: QueryConfig
  onSet: (patch: Partial<QueryConfig>) => void
}) {
  const [packages, setPackages] = useState<ScopePackage[]>([])

  useEffect(() => {
    api.GET("/api/v1/scope").then(({ data }) => {
      if (data) setPackages(data as ScopePackage[])
    })
  }, [])

  if (query.mode === "crosstab") {
    return (
      <div>
        <p className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
          Dataset
        </p>
        <Select
          value={query.dataset_id?.toString() ?? ""}
          onValueChange={(v) => onSet({ dataset_id: Number(v) || null })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select dataset…" />
          </SelectTrigger>
          <SelectContent>
            {packages.map((pkg) =>
              pkg.collections.map((col) => (
                <SelectGroup key={col.id}>
                  <SelectLabel>
                    {pkg.name} › {col.name}
                  </SelectLabel>
                  {col.datasets.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id.toString()}>
                      {pkg.name} › {col.name} › {ds.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )),
            )}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
        Collection
      </p>
      <Select
        value={query.collection_id?.toString() ?? ""}
        onValueChange={(v) => onSet({ collection_id: Number(v) || null })}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select collection…" />
        </SelectTrigger>
        <SelectContent>
          {packages.map((pkg) =>
            pkg.collections.map((col) => (
              <SelectItem key={col.id} value={col.id.toString()}>
                {pkg.name} › {col.name}
              </SelectItem>
            )),
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
