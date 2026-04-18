"use client"
import { useEffect, useMemo, useState } from "react"
import type { FieldNode, GroupNode } from "./FieldTree"

type Filter = "all" | "needs" | "ready"

interface Props {
  fields: FieldNode[]
  groups: GroupNode[]
  unassignedFields: FieldNode[]
  selectedFieldId: number | null
  onSelectField: (id: number) => void
  onMoveField: (fieldId: number, groupId: number | null) => void
}

export function FieldList({
  fields,
  groups,
  unassignedFields,
  selectedFieldId,
  onSelectField,
  onMoveField,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all")
  const [sort, setSort] = useState<"key" | "group" | "type">("key")
  const [menuFieldId, setMenuFieldId] = useState<number | null>(null)

  useEffect(() => {
    if (menuFieldId === null) return
    const handler = () => setMenuFieldId(null)
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [menuFieldId])

  const filtered = useMemo(() => {
    const groupById = Object.fromEntries(groups.map((g) => [g.id, g]))
    let list = [...fields, ...unassignedFields]
    if (filter === "needs") list = list.filter((f) => !f.display_name)
    if (filter === "ready") list = list.filter((f) => Boolean(f.display_name))
    if (sort === "key") list = [...list].sort((a, b) => a.field_key.localeCompare(b.field_key))
    if (sort === "group")
      list = [...list].sort((a, b) => {
        const ga = a.upload_fieldgroup_id ? (groupById[a.upload_fieldgroup_id]?.name ?? "") : ""
        const gb = b.upload_fieldgroup_id ? (groupById[b.upload_fieldgroup_id]?.name ?? "") : ""
        return ga.localeCompare(gb)
      })
    if (sort === "type")
      list = [...list].sort((a, b) =>
        (a.override_type ?? a.detected_type).localeCompare(b.override_type ?? b.detected_type),
      )
    return list
  }, [fields, unassignedFields, groups, filter, sort])

  return (
    <div className="flex flex-col gap-0">
      {/* Filter pills */}
      <div className="mb-1 flex gap-1 px-1">
        {(["all", "needs", "ready"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={[
              "rounded-full px-2 py-0.5 font-semibold text-xs",
              filter === f ? "bg-accent text-white" : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {f === "all" ? "All" : f === "needs" ? "⚠ Needs" : "✓ Ready"}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "key" | "group" | "type")}
          className="ml-auto rounded border border-border bg-background px-1 py-0.5 text-foreground text-xs"
          aria-label="Sort fields"
        >
          <option value="key">Sort: A–Z</option>
          <option value="group">Sort: Group</option>
          <option value="type">Sort: Type</option>
        </select>
      </div>
      {filtered.map((f) => {
        const groupById = Object.fromEntries(groups.map((g) => [g.id, g]))
        const groupName = f.upload_fieldgroup_id ? groupById[f.upload_fieldgroup_id]?.name : null
        return (
          <div
            key={f.id}
            className="group relative flex items-center gap-1 rounded px-2 py-1 hover:bg-muted"
            data-testid="field-list-row"
          >
            <button
              type="button"
              onClick={() => onSelectField(f.id)}
              className={[
                "flex flex-1 cursor-pointer items-center gap-2 text-xs",
                selectedFieldId === f.id ? "text-accent" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  f.display_name ? "bg-[--success]" : "bg-[--warning]",
                ].join(" ")}
                aria-hidden="true"
              />
              <span className="flex-1 truncate font-mono">{f.field_key}</span>
              <span className="truncate text-muted-foreground">{groupName ?? "—"}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMenuFieldId(menuFieldId === f.id ? null : f.id)
              }}
              className="ml-auto rounded p-0.5 opacity-0 hover:bg-muted-foreground/10 group-hover:opacity-100"
              aria-label="Field actions"
            >
              ⋮
            </button>
            {menuFieldId === f.id && (
              <div className="absolute top-6 right-0 z-10 min-w-32 rounded border border-border bg-popover shadow-md">
                <button
                  type="button"
                  onClick={() => {
                    onSelectField(f.id)
                    setMenuFieldId(null)
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                >
                  Edit
                </button>
                {f.upload_fieldgroup_id !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      onMoveField(f.id, null)
                      setMenuFieldId(null)
                    }}
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    Remove from group
                  </button>
                )}
                {groups.map(
                  (g) =>
                    g.id !== f.upload_fieldgroup_id && (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          onMoveField(f.id, g.id)
                          setMenuFieldId(null)
                        }}
                        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                      >
                        Move to {g.name}
                      </button>
                    ),
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
