"use client"
import { useMemo, useState } from "react"
import type { FieldNode, GroupNode } from "./FieldTree"

type Filter = "all" | "needs" | "ready"

interface Props {
  fields: FieldNode[]
  groups: GroupNode[]
  unassignedFields: FieldNode[]
  selectedFieldId: number | null
  onSelectField: (id: number) => void
}

export function FieldList({
  fields,
  groups,
  unassignedFields,
  selectedFieldId,
  onSelectField,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all")
  const [sort, setSort] = useState<"key" | "group" | "type">("key")

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
          <button
            key={f.id}
            type="button"
            onClick={() => onSelectField(f.id)}
            className={[
              "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs",
              selectedFieldId === f.id ? "bg-accent/10 text-accent" : "hover:bg-muted",
            ].join(" ")}
            data-testid="field-list-row"
          >
            <span
              className={[
                "h-1.5 w-1.5 shrink-0 rounded-full",
                f.display_name ? "bg-green-500" : "bg-amber-500",
              ].join(" ")}
              aria-hidden="true"
            />
            <span className="flex-1 truncate font-mono">{f.field_key}</span>
            <span className="truncate text-muted-foreground">{groupName ?? "—"}</span>
          </button>
        )
      })}
    </div>
  )
}
