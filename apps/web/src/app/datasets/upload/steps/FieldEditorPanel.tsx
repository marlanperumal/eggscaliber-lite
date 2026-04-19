"use client"
import type { components } from "@shared/api"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { FieldNode, GroupNode, Level } from "./FieldTree"

type FieldType = components["schemas"]["FieldType"]

const FIELD_TYPES = ["numeric", "ordinal", "categorical", "multi_response", "identifier", "weight"]

interface Props {
  sessionId: number
  field: FieldNode | null
  groups: GroupNode[]
  onSaved: (updated: FieldNode) => void
  onCancel: () => void
  onDelete: () => Promise<void>
  onCreateGroup: (name: string, parentId: number | null) => Promise<void>
}

export function FieldEditorPanel({
  sessionId,
  field,
  groups,
  onSaved,
  onCancel,
  onDelete,
  onCreateGroup,
}: Props) {
  const [displayName, setDisplayName] = useState("")
  const [overrideType, setOverrideType] = useState<string>("")
  const [groupId, setGroupId] = useState<string>("")
  const [sortOrder, setSortOrder] = useState<number>(0)
  const [levels, setLevels] = useState<Level[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")

  useEffect(() => {
    if (!field) return
    setDisplayName(field.display_name ?? "")
    setOverrideType(field.override_type ?? "")
    setGroupId(field.upload_fieldgroup_id ? String(field.upload_fieldgroup_id) : "")
    setSortOrder(field.sort_order)
    setLevels(field.levels ?? [])
  }, [field])

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return
    await onCreateGroup(newGroupName.trim(), null)
    setNewGroupName("")
    setShowNewGroup(false)
  }

  if (!field) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-muted-foreground text-xs">
        <span>Select a field to edit</span>
        {showNewGroup ? (
          <div className="flex w-full max-w-xs flex-col gap-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              placeholder="Group name"
              className="rounded border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="flex-1 rounded bg-accent px-3 py-1.5 font-semibold text-sm text-white disabled:opacity-40"
              >
                Create group
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewGroup(false)
                  setNewGroupName("")
                }}
                className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNewGroup(true)}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            + New group
          </button>
        )}
      </div>
    )
  }

  async function handleDeleteLevel(levelId: number) {
    if (!field) return
    if (levelId < 0) {
      setLevels((prev) => prev.filter((l) => l.id !== levelId))
      return
    }
    await api.DELETE("/api/v1/uploads/{upload_session_id}/fields/{field_id}/levels/{level_id}", {
      params: { path: { upload_session_id: sessionId, field_id: field.id, level_id: levelId } },
    })
    setLevels((prev) => prev.filter((l) => l.id !== levelId))
  }

  function handleAddLevel() {
    const maxOrder = levels.reduce((m, l) => Math.max(m, l.sort_order), -1)
    setLevels((prev) => [
      ...prev,
      {
        id: -Date.now(),
        raw_value: "",
        display_label: null,
        sort_order: maxOrder + 1,
        is_inherited: false,
      },
    ])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!field) return
    setBusy(true)
    try {
      const { data: savedField } = await api.PATCH(
        "/api/v1/uploads/{session_id}/fields/{field_id}",
        {
          params: { path: { session_id: sessionId, field_id: field.id } },
          body: {
            display_name: displayName || null,
            override_type: (overrideType || null) as FieldType | null,
            sort_order: sortOrder,
          },
        },
      )
      const newGroupId = groupId ? Number(groupId) : null
      if (newGroupId !== field.upload_fieldgroup_id) {
        await api.PATCH("/api/v1/uploads/{session_id}/fields/{field_id}/move", {
          params: { path: { session_id: sessionId, field_id: field.id } },
          body: { upload_fieldgroup_id: newGroupId },
        })
      }
      for (const lvl of levels) {
        if (!lvl.raw_value.trim()) continue
        await api.PUT("/api/v1/uploads/{upload_session_id}/fields/{field_id}/levels", {
          params: { path: { upload_session_id: sessionId, field_id: field.id } },
          body: {
            raw_value: lvl.raw_value,
            display_label: lvl.display_label,
            sort_order: lvl.sort_order,
            is_inherited: lvl.is_inherited,
          },
        })
      }
      if (savedField) {
        onSaved({
          ...field,
          display_name: savedField.display_name,
          override_type: savedField.override_type,
          sort_order: sortOrder,
          upload_fieldgroup_id: newGroupId,
          levels,
        })
      }
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
    levels.length > 0 || effectiveType === "categorical" || effectiveType === "ordinal"

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
              ? "bg-[--success-subtle] text-[--success-foreground]"
              : "bg-[--warning-subtle] text-[--warning-foreground]",
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
          <div className="rounded border border-border">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-1 border-border border-b px-2 py-1 font-semibold text-muted-foreground text-xs">
              <span>Raw value</span>
              <span>Display label</span>
              <span />
            </div>
            {levels.map((lvl, i) => (
              <div
                key={lvl.id}
                className="grid grid-cols-[1fr_1fr_auto] items-center gap-1 px-2 py-1"
              >
                {lvl.id < 0 ? (
                  <input
                    type="text"
                    value={lvl.raw_value}
                    onChange={(e) =>
                      setLevels((prev) =>
                        prev.map((l, j) => (j === i ? { ...l, raw_value: e.target.value } : l)),
                      )
                    }
                    placeholder="raw value"
                    className="rounded border border-accent bg-background px-2 py-0.5 font-mono text-xs"
                  />
                ) : (
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="truncate font-mono text-muted-foreground text-xs">
                      {lvl.raw_value}
                    </span>
                    {lvl.is_inherited && (
                      <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-semibold text-muted-foreground text-xs">
                        inherited
                      </span>
                    )}
                  </div>
                )}
                <input
                  type="text"
                  value={lvl.id < 0 ? "" : (lvl.display_label ?? "")}
                  onChange={(e) =>
                    setLevels((prev) =>
                      prev.map((l, j) =>
                        j === i ? { ...l, display_label: e.target.value || null } : l,
                      ),
                    )
                  }
                  placeholder={lvl.id < 0 ? "label (optional)" : lvl.raw_value}
                  disabled={lvl.id < 0}
                  className="rounded border border-border bg-background px-2 py-0.5 text-xs disabled:opacity-50"
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
          <button
            type="button"
            onClick={handleAddLevel}
            className="text-accent text-xs hover:underline"
          >
            + Add level
          </button>
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
