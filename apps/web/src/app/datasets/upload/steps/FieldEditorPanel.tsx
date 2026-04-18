"use client"
import { useEffect, useState } from "react"
import type { FieldNode, GroupNode, Level } from "./FieldTree"

const FIELD_TYPES = ["numeric", "ordinal", "categorical", "multi_response", "identifier", "weight"]
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

interface Props {
  sessionId: number
  field: FieldNode | null
  groups: GroupNode[]
  onSaved: (updated: FieldNode) => void
  onCancel: () => void
  onDelete: () => Promise<void>
}

export function FieldEditorPanel({ sessionId, field, groups, onSaved, onCancel, onDelete }: Props) {
  const [displayName, setDisplayName] = useState("")
  const [overrideType, setOverrideType] = useState<string>("")
  const [groupId, setGroupId] = useState<string>("")
  const [sortOrder, setSortOrder] = useState<number>(0)
  const [levels, setLevels] = useState<Level[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!field) return
    setDisplayName(field.display_name ?? "")
    setOverrideType(field.override_type ?? "")
    setGroupId(field.upload_fieldgroup_id ? String(field.upload_fieldgroup_id) : "")
    setSortOrder(field.sort_order)
    setLevels(field.levels ?? [])
  }, [field])

  if (!field) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
        Select a field to edit
      </div>
    )
  }

  async function handleDeleteLevel(levelId: number) {
    if (!field) return
    await fetch(`${API_BASE}/api/v1/uploads/${sessionId}/fields/${field.id}/levels/${levelId}`, {
      method: "DELETE",
    })
    setLevels((prev) => prev.filter((l) => l.id !== levelId))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!field) return
    setBusy(true)
    try {
      const r1 = await fetch(`${API_BASE}/api/v1/uploads/${sessionId}/fields/${field.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName || null,
          override_type: overrideType || null,
          sort_order: sortOrder,
        }),
      })
      const newGroupId = groupId ? Number(groupId) : null
      if (newGroupId !== field.upload_fieldgroup_id) {
        await fetch(`${API_BASE}/api/v1/uploads/${sessionId}/fields/${field.id}/move`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upload_fieldgroup_id: newGroupId }),
        })
      }
      // Upsert each level
      for (const lvl of levels) {
        await fetch(`${API_BASE}/api/v1/uploads/${sessionId}/fields/${field.id}/levels`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            raw_value: lvl.raw_value,
            display_label: lvl.display_label,
            sort_order: lvl.sort_order,
          }),
        })
      }
      const data = await r1.json()
      onSaved({
        ...field,
        display_name: data.display_name,
        override_type: data.override_type,
        sort_order: sortOrder,
        upload_fieldgroup_id: newGroupId,
        levels,
      })
    } finally {
      setBusy(false)
    }
  }

  // Build flat group path list for selector
  function groupPath(g: GroupNode): string {
    const parent = groups.find((p) => p.id === g.parent_id)
    return parent ? `${groupPath(parent)} › ${g.name}` : g.name
  }

  const selectedGroup = groupId ? groups.find((g) => g.id === Number(groupId)) : null
  const effectiveType = overrideType || field.detected_type
  const showLevels =
    field.levels.length > 0 || effectiveType === "categorical" || effectiveType === "ordinal"

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 overflow-auto p-4">
      {/* Breadcrumb */}
      <p className="text-muted-foreground text-xs">
        {selectedGroup ? groupPath(selectedGroup) : "Unassigned"} ›{" "}
        <span className="font-mono font-semibold text-foreground">{field.field_key}</span>
      </p>

      <div>
        <label
          className="mb-1 block font-semibold text-muted-foreground text-xs"
          htmlFor="display-name"
        >
          Display name
        </label>
        <input
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={field.field_key}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Status chip */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Status</span>
        <span
          className={[
            "rounded-full px-2 py-0.5 font-semibold text-xs",
            field.override_type || field.display_name
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
          ].join(" ")}
        >
          {field.override_type || field.display_name ? "✓ Ready" : "⚠ Needs review"}
        </span>
      </div>

      {/* Sort order */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">Sort order</span>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          className="w-24 rounded border border-border bg-background px-2 py-1 text-sm"
        />
      </label>

      <div>
        <label
          className="mb-1 block font-semibold text-muted-foreground text-xs"
          htmlFor="field-type"
        >
          Field type
        </label>
        <select
          id="field-type"
          value={overrideType}
          onChange={(e) => setOverrideType(e.target.value)}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">— detected: {field.detected_type} —</option>
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          className="mb-1 block font-semibold text-muted-foreground text-xs"
          htmlFor="field-group"
        >
          Group
        </label>
        <select
          id="field-group"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">— Unassigned —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {groupPath(g)}
            </option>
          ))}
        </select>
      </div>

      {showLevels && (
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs">Levels</span>
          <div className="space-y-1 rounded border border-border p-2">
            {levels.map((lvl, i) => (
              <div key={lvl.id} className="flex items-center gap-1">
                <input
                  type="text"
                  value={lvl.display_label ?? lvl.raw_value}
                  onChange={(e) =>
                    setLevels((prev) =>
                      prev.map((l, j) => (j === i ? { ...l, display_label: e.target.value } : l)),
                    )
                  }
                  placeholder={lvl.raw_value}
                  className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteLevel(lvl.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove level"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border px-4 py-1.5 text-muted-foreground text-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded bg-accent px-4 py-1.5 font-semibold text-sm text-white disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="rounded border border-destructive px-4 py-1.5 text-destructive text-sm hover:bg-destructive/10"
        >
          Delete
        </button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl border border-border bg-background p-6 shadow-xl">
            <p className="mb-1 font-semibold text-sm">Delete field "{field.field_key}"?</p>
            <p className="mb-4 text-muted-foreground text-xs">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false)
                  void onDelete()
                }}
                className="rounded-lg bg-destructive px-4 py-2 font-semibold text-sm text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
