"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { mutate } from "@/lib/mutate"
import type { WizardState, WizardStep } from "../wizard-types"
import { FieldEditorPanel } from "./FieldEditorPanel"
import { FieldList } from "./FieldList"
import { type FieldNode, FieldTree, type GroupNode } from "./FieldTree"

type PanelTab = "tree" | "list"

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
}

export function MetadataEditor({ state, setStep }: Props) {
  const [panelTab, setPanelTab] = useState<PanelTab>("tree")
  const [groups, setGroups] = useState<GroupNode[]>([])
  const [fields, setFields] = useState<FieldNode[]>([])
  const [unassigned, setUnassigned] = useState<FieldNode[]>([])
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadTree() {
    if (!state.sessionId) return
    const { data } = await api.GET("/api/v1/uploads/{session_id}/field-tree", {
      params: { path: { session_id: state.sessionId } },
    })
    if (data) {
      setGroups(data.groups)
      setFields(data.fields)
      setUnassigned(data.unassigned_fields)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadTree intentionally excluded
  useEffect(() => {
    loadTree().then(() => setLoading(false))
  }, [state.sessionId])

  async function handleMoveField(fieldId: number, groupId: number | null) {
    if (!state.sessionId) return
    await mutate(
      () =>
        api.PATCH("/api/v1/uploads/{session_id}/fields/{field_id}/move", {
          params: { path: { session_id: state.sessionId!, field_id: fieldId } },
          body: { upload_fieldgroup_id: groupId },
        }),
      { errorMessage: "Failed to move field. Please try again." },
    )
    await loadTree()
  }

  async function handleCreateGroup(name: string, parentId: number | null) {
    if (!state.sessionId) return
    await mutate(
      () =>
        api.POST("/api/v1/uploads/{session_id}/fieldgroups", {
          params: { path: { session_id: state.sessionId! } },
          body: { name, parent_id: parentId, sort_order: 0 },
        }),
      { errorMessage: "Failed to create group. Please try again." },
    )
    await loadTree()
  }

  async function handleDeleteGroup(id: number) {
    if (!state.sessionId) return
    await mutate(
      () =>
        api.DELETE("/api/v1/uploads/{session_id}/fieldgroups/{group_id}", {
          params: { path: { session_id: state.sessionId!, group_id: id } },
        }),
      { errorMessage: "Failed to delete group. Please try again." },
    )
    await loadTree()
  }

  async function handleMoveGroup(groupId: number, parentId: number | null) {
    if (!state.sessionId) return
    await mutate(
      () =>
        api.PATCH("/api/v1/uploads/{session_id}/fieldgroups/{group_id}", {
          params: { path: { session_id: state.sessionId!, group_id: groupId } },
          body: { parent_id: parentId },
        }),
      { errorMessage: "Failed to move group. Please try again." },
    )
    await loadTree()
  }

  const selectedField = [...fields, ...unassigned].find((f) => f.id === selectedFieldId) ?? null

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base text-foreground">Step 4 — Metadata Editor</h2>
      <div className="flex h-[520px] gap-0 overflow-hidden rounded-lg border border-border">
        {/* Left panel */}
        <div className="flex w-60 shrink-0 flex-col border-border border-r">
          {/* Toggle tabs */}
          <div className="flex border-border border-b">
            {(["tree", "list"] as PanelTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPanelTab(t)}
                aria-pressed={panelTab === t}
                className={[
                  "flex-1 py-2 font-semibold text-xs",
                  panelTab === t ? "border-accent border-b-2 text-accent" : "text-muted-foreground",
                ].join(" ")}
              >
                {t === "tree" ? "🌲 Tree" : "☰ List"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-1">
            {panelTab === "tree" ? (
              <FieldTree
                groups={groups}
                fields={fields}
                unassignedFields={unassigned}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onMoveField={handleMoveField}
                onCreateGroup={handleCreateGroup}
                onRenameGroup={async (id: number, name: string) => {
                  if (!state.sessionId) return
                  await mutate(
                    () =>
                      api.PATCH("/api/v1/uploads/{session_id}/fieldgroups/{group_id}", {
                        params: { path: { session_id: state.sessionId!, group_id: id } },
                        body: { name },
                      }),
                    { errorMessage: "Failed to rename group. Please try again." },
                  )
                  await loadTree()
                }}
                onDeleteGroup={handleDeleteGroup}
                onMoveGroup={handleMoveGroup}
              />
            ) : (
              <FieldList
                groups={groups}
                fields={fields}
                unassignedFields={unassigned}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onMoveField={handleMoveField}
              />
            )}
          </div>
        </div>

        {/* Right editor panel */}
        <div className="flex-1 overflow-hidden">
          <FieldEditorPanel
            sessionId={state.sessionId ?? 0}
            field={selectedField}
            groups={groups}
            onSaved={async () => await loadTree()}
            onCancel={() => setSelectedFieldId(null)}
            onDelete={async () => {
              if (!state.sessionId || !selectedFieldId) return
              await mutate(
                () =>
                  api.DELETE("/api/v1/uploads/{upload_session_id}/fields/{field_id}", {
                    params: {
                      path: { upload_session_id: state.sessionId!, field_id: selectedFieldId },
                    },
                  }),
                { errorMessage: "Failed to delete field. Please try again." },
              )
              setSelectedFieldId(null)
              await loadTree()
            }}
            onCreateGroup={handleCreateGroup}
          />
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep(state.needsReconcile ? 3 : 2)}
          className="rounded-lg border border-border px-5 py-2 font-semibold text-muted-foreground text-sm hover:bg-muted"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => setStep(5)}
          className="rounded-lg bg-accent px-6 py-2 font-semibold text-sm text-white"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
