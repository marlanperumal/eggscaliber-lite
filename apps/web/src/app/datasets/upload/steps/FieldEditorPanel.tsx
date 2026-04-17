"use client"
import { useEffect, useState } from "react"
import type { FieldNode, GroupNode } from "./FieldTree"

const FIELD_TYPES = ["numeric", "ordinal", "categorical", "multi_response", "identifier", "weight"]
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

interface Props {
  sessionId: number
  field: FieldNode | null
  groups: GroupNode[]
  onSaved: (updated: FieldNode) => void
}

export function FieldEditorPanel({ sessionId, field, groups, onSaved }: Props) {
  const [displayName, setDisplayName] = useState("")
  const [overrideType, setOverrideType] = useState<string>("")
  const [groupId, setGroupId] = useState<string>("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!field) return
    setDisplayName(field.display_name ?? "")
    setOverrideType(field.override_type ?? "")
    setGroupId(field.upload_fieldgroup_id ? String(field.upload_fieldgroup_id) : "")
  }, [field])

  if (!field) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
        Select a field to edit
      </div>
    )
  }

  async function handleSave() {
    if (!field) return
    setBusy(true)
    const r1 = await fetch(`${API_BASE}/api/v1/uploads/${sessionId}/fields/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName || null,
        override_type: overrideType || null,
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
    const data = await r1.json()
    onSaved({
      ...field,
      display_name: data.display_name,
      override_type: data.override_type,
      upload_fieldgroup_id: newGroupId,
    })
    setBusy(false)
  }

  // Build flat group path list for selector
  function groupPath(g: GroupNode): string {
    const parent = groups.find((p) => p.id === g.parent_id)
    return parent ? `${groupPath(parent)} › ${g.name}` : g.name
  }

  const selectedGroup = groupId ? groups.find((g) => g.id === Number(groupId)) : null

  return (
    <div className="flex flex-col gap-4 overflow-auto p-4">
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

      <div className="mt-auto flex justify-end gap-2 border-border border-t pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="rounded-lg bg-accent px-5 py-2 font-semibold text-sm text-white disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  )
}
