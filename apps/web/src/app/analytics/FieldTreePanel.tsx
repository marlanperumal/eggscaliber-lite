"use client"
import { ChevronDown, ChevronRight, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"
import type { QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"

interface FieldNode {
  id: number
  field_key: string
  display_name: string
  field_type: string
  is_filterable: boolean
  sort_order: number
}

interface GroupNode {
  id: number
  name: string
  slug: string
  sort_order: number
  fields: FieldNode[]
  children: GroupNode[]
}

interface FieldTree {
  groups: GroupNode[]
  ungrouped_fields: FieldNode[]
}

interface Props {
  onCollapse: () => void
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => void
}

export function FieldTreePanel({ onCollapse, query, onQueryChange }: Props) {
  const [tree, setTree] = useState<FieldTree | null>(null)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  // In trending mode, resolve the first dataset in the collection to use for
  // the field tree (the collection shares a common field schema across datasets)
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

  // Ref so the tree-load effect can read the current query without re-subscribing
  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  })

  useEffect(() => {
    if (!effectiveDatasetId) {
      setTree(null)
      return
    }
    api
      .GET("/api/v1/datasets/{dataset_id}/field-tree", {
        params: { path: { dataset_id: effectiveDatasetId } },
      })
      .then(({ data }) => {
        if (data) {
          const t = data as FieldTree
          setTree(t)
          setExpanded(new Set(t.groups.map((g) => g.id)))

          // Enrich display_names for any chips restored from URL (display_name not stored in URL)
          const allFields: FieldNode[] = []
          const collectFields = (g: GroupNode) => {
            allFields.push(...g.fields)
            g.children.forEach(collectFields)
          }
          t.groups.forEach(collectFields)
          allFields.push(...t.ungrouped_fields)
          const byKey = Object.fromEntries(allFields.map((f) => [f.field_key, f]))

          // Only call onQueryChange if there are actually chips that need enriching
          // (avoids spurious calls when query was freshly built from the UI)
          // Read via ref so the effect doesn't re-run on every query field change
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
  }, [effectiveDatasetId, onQueryChange])

  const toggleGroup = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const addToRows = useCallback(
    (field: FieldNode) => {
      onQueryChange((prev) => {
        const base = prev ?? DEFAULT_QUERY
        if (base.rows.some((r) => r.field_key === field.field_key)) return base
        return {
          ...base,
          rows: [...base.rows, { field_key: field.field_key, display_name: field.display_name }],
        }
      })
    },
    [onQueryChange],
  )

  const addToColumns = useCallback(
    (field: FieldNode) => {
      onQueryChange((prev) => {
        const base = prev ?? DEFAULT_QUERY
        if (base.columns.some((c) => c.field_key === field.field_key)) return base
        return {
          ...base,
          columns: [
            ...base.columns,
            { field_key: field.field_key, display_name: field.display_name },
          ],
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
    return (
      <div
        key={f.field_key}
        data-testid={`field-row-${f.field_key}`}
        className="group flex w-full items-center gap-1 rounded py-0.5 pl-4 hover:bg-muted/50"
      >
        <button
          type="button"
          className="flex-1 cursor-pointer text-left text-sm"
          onClick={() => addToRows(f)}
        >
          {f.display_name}
        </button>
        <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            className="rounded px-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => addToRows(f)}
          >
            +R
          </button>
          {isCrosstab && (
            <button
              type="button"
              className="rounded px-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => addToColumns(f)}
            >
              +C
            </button>
          )}
        </div>
      </div>
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
          <span className="text-sm font-medium">{g.name}</span>
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">Fields</span>
        <button
          type="button"
          onClick={onCollapse}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-3 py-2">
        <input
          type="search"
          placeholder="Search fields…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-1">
        {!effectiveDatasetId && (
          <p className="px-3 py-4 text-sm text-muted-foreground">Select a dataset to see fields.</p>
        )}
        {tree && (
          <>
            {tree.groups.map((g) => renderGroup(g))}
            {tree.ungrouped_fields.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
