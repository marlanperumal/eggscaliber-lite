import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useCallback, useState } from "react"
import type { FieldSelection, QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"

export type ZoneName = "rows" | "columns" | "breakdown"

export interface DragEventArgs {
  activeType: "field" | "chip"
  fieldKey: string
  displayName: string | undefined
  fieldType: string | undefined
  sourceZone: ZoneName | null
  overId: string | null
}

export interface ActiveDragState {
  activeType: "field" | "chip"
  fieldKey: string
  displayName: string | undefined
  fieldType: string | undefined
  sourceZone: ZoneName | null
  overZone: ZoneName | null
}

// ── Zone ID helpers ────────────────────────────────────────────────────────

const ZONE_DROP_IDS: Record<string, ZoneName> = {
  "zone-rows": "rows",
  "zone-columns": "columns",
  "zone-breakdown": "breakdown",
}

export function getZoneFromId(id: string): ZoneName | null {
  if (id in ZONE_DROP_IDS) return ZONE_DROP_IDS[id]
  if (id.startsWith("chip-rows-")) return "rows"
  if (id.startsWith("chip-columns-")) return "columns"
  if (id === "chip-breakdown") return "breakdown"
  return null
}

// ── Pure mutation function (exported for tests) ────────────────────────────

export function applyDragEnd(q: QueryConfig, args: DragEventArgs): QueryConfig {
  const { activeType, fieldKey, displayName, fieldType, sourceZone, overId } = args
  const field: FieldSelection = {
    field_key: fieldKey,
    display_name: displayName,
    field_type: fieldType,
  }

  if (activeType === "field") {
    if (!overId) return q
    const targetZone = getZoneFromId(overId)
    if (!targetZone) return q
    return addToZone(q, field, targetZone)
  }

  // chip drag
  if (!overId) {
    return removeFromZone(q, fieldKey, sourceZone!)
  }

  const targetZone = getZoneFromId(overId)
  if (!targetZone) return q

  if (targetZone === sourceZone) {
    // Reorder within zone
    if (sourceZone === "breakdown") return q
    const items = sourceZone === "rows" ? q.rows : q.columns
    const oldIndex = items.findIndex((f) => f.field_key === fieldKey)
    const overFieldKey = overId.startsWith("chip-")
      ? overId.replace(`chip-${sourceZone}-`, "")
      : null
    const newIndex = overFieldKey ? items.findIndex((f) => f.field_key === overFieldKey) : -1
    if (oldIndex === -1 || newIndex === -1) return q
    const reordered = arrayMove(items, oldIndex, newIndex)
    return sourceZone === "rows" ? { ...q, rows: reordered } : { ...q, columns: reordered }
  }

  // Move to different zone
  const updated = removeFromZone(q, fieldKey, sourceZone!)
  return addToZone(updated, field, targetZone)
}

function addToZone(q: QueryConfig, field: FieldSelection, zone: ZoneName): QueryConfig {
  if (zone === "rows") {
    if (q.rows.some((r) => r.field_key === field.field_key)) return q
    return { ...q, rows: [...q.rows, field] }
  }
  if (zone === "columns") {
    if (q.columns.some((c) => c.field_key === field.field_key)) return q
    return { ...q, columns: [...q.columns, field] }
  }
  return { ...q, breakdown: field }
}

function removeFromZone(q: QueryConfig, fieldKey: string, zone: ZoneName): QueryConfig {
  if (zone === "rows") return { ...q, rows: q.rows.filter((r) => r.field_key !== fieldKey) }
  if (zone === "columns")
    return { ...q, columns: q.columns.filter((c) => c.field_key !== fieldKey) }
  return { ...q, breakdown: null }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useDragAndDrop({
  query,
  onQueryChange,
}: {
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => void
}) {
  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null)

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    const d = active.data.current as {
      type: "field" | "chip"
      field_key: string
      display_name?: string
      field_type?: string
      sourceZone?: ZoneName
    }
    setActiveDrag({
      activeType: d.type,
      fieldKey: d.field_key,
      displayName: d.display_name,
      fieldType: d.field_type,
      sourceZone: d.sourceZone ?? null,
      overZone: null,
    })
  }, [])

  const onDragOver = useCallback(({ over }: DragOverEvent) => {
    setActiveDrag((prev) =>
      prev ? { ...prev, overZone: over ? getZoneFromId(String(over.id)) : null } : null,
    )
  }, [])

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveDrag(null)
      const d = active.data.current as {
        type: "field" | "chip"
        field_key: string
        display_name?: string
        field_type?: string
        sourceZone?: ZoneName
      }
      onQueryChange((prev) => {
        const q = prev ?? DEFAULT_QUERY
        return applyDragEnd(q, {
          activeType: d.type,
          fieldKey: d.field_key,
          displayName: d.display_name,
          fieldType: d.field_type,
          sourceZone: d.sourceZone ?? null,
          overId: over ? String(over.id) : null,
        })
      })
    },
    [onQueryChange],
  )

  const onDragCancel = useCallback(() => setActiveDrag(null), [])

  return { activeDrag, onDragStart, onDragOver, onDragEnd, onDragCancel }
}
