"use client"
import { useDraggable } from "@dnd-kit/core"
import type { components } from "@shared/api"
import { ChevronDown, ChevronRight, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"
import { EmptyState } from "./EmptyState"
import { FieldTreeIllustration } from "./illustrations/FieldTreeIllustration"

type FieldNode = components["schemas"]["FieldTreeFieldOut"]
type GroupNode = components["schemas"]["FieldTreeGroupOut"]
type FieldTree = components["schemas"]["FieldTreeOut"]

interface Props {
  onCollapse: () => void
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => void
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

export function FieldTreePanel({ onCollapse, query, onQueryChange }: Props) {
  const [tree, setTree] = useState<FieldTree | null>(null)
  const [treeLoading, setTreeLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [effectiveDatasetId, setEffectiveDatasetId] = useState<number | null>(null)

  useEffect(() => {
    const dsId = query?.dataset_id
    const colId = query?.collection_id
    if (dsId) {
      setEffectiveDatasetId(dsId)
    } else if (colId) {
      api.GET("/api/v1/scope").then(({ data }) => {
        if (!data) return
        for (const pkg of data as {
          id: number
          name: string
          collections: { id: number; datasets: { id: number }[] }[]
        }[]) {
          for (const col of pkg.collections) {
            if (col.id === colId && col.datasets.length > 0) {
              setEffectiveDatasetId(col.datasets[0].id)
              return
            }
          }
        }
      })
    } else {
      setEffectiveDatasetId(null)
    }
  }, [query?.dataset_id, query?.collection_id])

  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  })

  useEffect(() => {
    if (!effectiveDatasetId) {
      setTree(null)
      setTreeLoading(false)
      return
    }
    setTreeLoading(true)
    api
      .GET("/api/v1/datasets/{dataset_id}/field-tree", {
        params: { path: { dataset_id: effectiveDatasetId } },
      })
      .then(({ data }) => {
        if (data) {
          const t = data as FieldTree
          setTree(t)
          setTreeLoading(false)
          setExpanded(new Set(t.groups.map((g) => g.id)))

          const allFields: FieldNode[] = []
          const collectFields = (g: GroupNode) => {
            allFields.push(...g.fields)
            g.children.forEach(collectFields)
          }
          t.groups.forEach(collectFields)
          allFields.push(...t.ungrouped_fields)
          const byKey = Object.fromEntries(allFields.map((f) => [f.field_key, f]))

          const currentQuery = queryRef.current
          const needsEnrich =
            currentQuery?.rows.some((r) => !r.display_name && byKey[r.field_key]) ||
            currentQuery?.columns.some((c) => !c.display_name && byKey[c.field_key])
          if (needsEnrich) {
            onQueryChange((prev) => {
              if (!prev) return prev as unknown as QueryConfig
              return {
                ...prev,
                rows: prev.rows.map((r) =>
                  !r.display_name && byKey[r.field_key]
                    ? { ...r, display_name: byKey[r.field_key].display_name }
                    : r,
                ),
                columns: prev.columns.map((c) =>
                  !c.display_name && byKey[c.field_key]
                    ? { ...c, display_name: byKey[c.field_key].display_name }
                    : c,
                ),
              }
            })
          }
        }
      })
      .catch(() => {
        setTreeLoading(false)
      })
  }, [effectiveDatasetId, onQueryChange])

  const toggleGroup = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleFieldClick = useCallback(
    (field: FieldNode) => {
      onQueryChange((prev) => {
        const base = prev ?? DEFAULT_QUERY
        const inRows = base.rows.some((r) => r.field_key === field.field_key)
        const inCols = base.columns.some((c) => c.field_key === field.field_key)
        const inBreakdown = base.breakdown?.field_key === field.field_key
        if (inRows || inCols || inBreakdown) {
          return {
            ...base,
            rows: base.rows.filter((r) => r.field_key !== field.field_key),
            columns: base.columns.filter((c) => c.field_key !== field.field_key),
            breakdown: inBreakdown ? null : base.breakdown,
          }
        }
        return {
          ...base,
          rows: [
            ...base.rows,
            {
              field_key: field.field_key,
              display_name: field.display_name,
              field_type: field.field_type,
            },
          ],
        }
      })
    },
    [onQueryChange],
  )

  const toggleZone = useCallback(
    (field: FieldNode, zone: "rows" | "columns" | "breakdown") => {
      onQueryChange((prev) => {
        const base = prev ?? DEFAULT_QUERY
        if (zone === "rows") {
          if (base.rows.some((r) => r.field_key === field.field_key)) {
            return { ...base, rows: base.rows.filter((r) => r.field_key !== field.field_key) }
          }
          return {
            ...base,
            rows: [
              ...base.rows,
              {
                field_key: field.field_key,
                display_name: field.display_name,
                field_type: field.field_type,
              },
            ],
          }
        }
        if (zone === "columns") {
          if (base.columns.some((c) => c.field_key === field.field_key)) {
            return { ...base, columns: base.columns.filter((c) => c.field_key !== field.field_key) }
          }
          return {
            ...base,
            columns: [
              ...base.columns,
              {
                field_key: field.field_key,
                display_name: field.display_name,
                field_type: field.field_type,
              },
            ],
          }
        }
        // breakdown
        if (base.breakdown?.field_key === field.field_key) {
          return { ...base, breakdown: null }
        }
        return {
          ...base,
          breakdown: {
            field_key: field.field_key,
            display_name: field.display_name,
            field_type: field.field_type,
          },
        }
      })
    },
    [onQueryChange],
  )

  const q = search.toLowerCase()
  const matchesSearch = (text: string) => !q || text.toLowerCase().includes(q)

  const isCrosstab = (query?.mode ?? "crosstab") === "crosstab"

  const renderField = (f: FieldNode) => {
    if (!matchesSearch(f.display_name)) return null
    const q = query ?? DEFAULT_QUERY
    const inRows = q.rows.some((r) => r.field_key === f.field_key)
    const inCols = q.columns.some((c) => c.field_key === f.field_key)
    const inBreakdown = q.breakdown?.field_key === f.field_key

    return (
      <DraggableFieldRow
        key={f.field_key}
        field={f}
        inRows={inRows}
        inCols={inCols}
        inBreakdown={inBreakdown}
        isCrosstab={isCrosstab}
        onFieldClick={handleFieldClick}
        onToggleZone={toggleZone}
      />
    )
  }

  const renderGroup = (g: GroupNode, depth = 0): React.ReactNode => {
    const childFields = g.fields.filter((f) => matchesSearch(f.display_name))
    const childGroups = g.children.filter(
      (c) => matchesSearch(c.name) || c.fields.some((f) => matchesSearch(f.display_name)),
    )
    if (!matchesSearch(g.name) && childFields.length === 0 && childGroups.length === 0) return null
    const isOpen = expanded.has(g.id) || (!!q && (childFields.length > 0 || childGroups.length > 0))
    return (
      <div key={g.id}>
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded py-1 text-left hover:bg-muted/50"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => toggleGroup(g.id)}
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <span className="font-medium text-sm">{g.name}</span>
        </button>
        {isOpen && (
          <div>
            {childGroups.map((c) => renderGroup(c, depth + 1))}
            {childFields.map(renderField)}
          </div>
        )}
      </div>
    )
  }

  const isEmptyTree =
    tree !== null && tree.groups.length === 0 && tree.ungrouped_fields.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between border-border border-b bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Fields</span>
          {treeLoading && <PanelSpinner />}
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search input */}
      <div className="px-3 py-2">
        <Input
          type="search"
          placeholder="Search fields…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 px-2 py-1 text-xs"
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-1">
        {!effectiveDatasetId && (
          <EmptyState
            illustration={<FieldTreeIllustration />}
            title="No dataset selected"
            body="Choose a dataset in the Query Builder to browse fields"
          />
        )}

        {effectiveDatasetId && treeLoading && (
          <div role="status" aria-label="Loading fields" className="space-y-2 px-3 py-2">
            <Skeleton className="h-4 w-[70%]" />
            <Skeleton className="ml-4 h-3 w-[50%]" />
            <Skeleton className="ml-4 h-3 w-[60%]" />
            <Skeleton className="mt-2 h-4 w-[55%]" />
            <Skeleton className="ml-4 h-3 w-[45%]" />
            <Skeleton className="ml-4 h-3 w-[65%]" />
          </div>
        )}

        {effectiveDatasetId && isEmptyTree && (
          <EmptyState
            illustration={<FieldTreeIllustration />}
            title="No fields"
            body="This dataset has no browsable fields"
          />
        )}

        {tree && !isEmptyTree && (
          <>
            {tree.groups.map((g) => renderGroup(g))}
            {tree.ungrouped_fields.length > 0 && (
              <div>
                <p className="px-2 py-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Ungrouped
                </p>
                {tree.ungrouped_fields.map(renderField)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── DraggableFieldRow ─────────────────────────────────────────────────────

function DraggableFieldRow({
  field,
  inRows,
  inCols,
  inBreakdown,
  isCrosstab,
  onFieldClick,
  onToggleZone,
}: {
  field: FieldNode
  inRows: boolean
  inCols: boolean
  inBreakdown: boolean
  isCrosstab: boolean
  onFieldClick: (f: FieldNode) => void
  onToggleZone: (f: FieldNode, zone: "rows" | "columns" | "breakdown") => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-${field.field_key}`,
    data: {
      type: "field",
      field_key: field.field_key,
      display_name: field.display_name,
      field_type: field.field_type,
    },
  })

  return (
    <div
      ref={setNodeRef}
      data-testid={`field-row-${field.field_key}`}
      className={cn(
        "group grid items-center gap-1 rounded py-0.5 pl-4 hover:bg-muted/50",
        isDragging && "opacity-40",
      )}
      style={{ gridTemplateColumns: "1fr 22px 22px" }}
    >
      <button
        type="button"
        className="flex-1 cursor-grab truncate text-left text-sm active:cursor-grabbing"
        onClick={() => onFieldClick(field)}
        aria-label={field.display_name}
        {...listeners}
        {...attributes}
      >
        {field.display_name}
      </button>
      <ZoneToggleButton
        label="R"
        isOn={inRows}
        colorVar="var(--zone-rows)"
        ariaLabelOn={`Remove ${field.display_name} from Rows`}
        ariaLabelOff={`Add ${field.display_name} to Rows`}
        onClick={() => onToggleZone(field, "rows")}
      />
      {isCrosstab ? (
        <ZoneToggleButton
          label="C"
          isOn={inCols}
          colorVar="var(--zone-columns)"
          ariaLabelOn={`Remove ${field.display_name} from Columns`}
          ariaLabelOff={`Add ${field.display_name} to Columns`}
          onClick={() => onToggleZone(field, "columns")}
        />
      ) : (
        <ZoneToggleButton
          label="B"
          isOn={inBreakdown}
          colorVar="var(--zone-breakdown)"
          ariaLabelOn={`Remove ${field.display_name} from Breakdown`}
          ariaLabelOff={`Add ${field.display_name} to Breakdown`}
          onClick={() => onToggleZone(field, "breakdown")}
        />
      )}
    </div>
  )
}

// ── ZoneToggleButton ──────────────────────────────────────────────────────

function ZoneToggleButton({
  label,
  isOn,
  colorVar,
  ariaLabelOn,
  ariaLabelOff,
  onClick,
}: {
  label: string
  isOn: boolean
  colorVar: string
  ariaLabelOn: string
  ariaLabelOff: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={isOn ? ariaLabelOn : ariaLabelOff}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={
        isOn
          ? {
              color: colorVar,
              background: `color-mix(in srgb, ${colorVar} 15%, transparent)`,
              borderColor: `color-mix(in srgb, ${colorVar} 40%, transparent)`,
            }
          : undefined
      }
      className={cn(
        "flex h-[18px] w-[22px] items-center justify-center rounded border font-black text-[9px] transition-colors",
        isOn
          ? "border-solid"
          : "border-transparent text-transparent group-hover:border-border group-hover:text-muted-foreground",
      )}
    >
      {label}
    </button>
  )
}
