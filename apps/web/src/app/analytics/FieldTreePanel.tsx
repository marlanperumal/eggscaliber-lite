"use client"
import { ChevronDown, ChevronRight, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
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

  useEffect(() => {
    if (!query?.dataset_id) {
      setTree(null)
      return
    }
    api
      .GET("/api/v1/datasets/{dataset_id}/field-tree", {
        params: { path: { dataset_id: query.dataset_id } },
      })
      .then(({ data }) => {
        if (data) {
          const t = data as FieldTree
          setTree(t)
          setExpanded(new Set(t.groups.map((g) => g.id)))
        }
      })
  }, [query?.dataset_id])

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

  const q = search.toLowerCase()
  const matchesSearch = (text: string) => !q || text.toLowerCase().includes(q)

  const renderField = (f: FieldNode) => {
    if (!matchesSearch(f.display_name)) return null
    return (
      <button
        type="button"
        key={f.field_key}
        className="group flex w-full cursor-pointer items-center gap-1 rounded py-0.5 pl-4 text-left hover:bg-muted/50"
        onClick={() => addToRows(f)}
      >
        <span className="flex-1 text-sm">{f.display_name}</span>
        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
          + rows
        </span>
      </button>
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
    <div className="flex h-full flex-col border-r border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
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
        {!query?.dataset_id && (
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
