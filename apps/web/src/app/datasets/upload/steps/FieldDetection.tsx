"use client"
import type { components } from "@shared/api"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { mutate } from "@/lib/mutate"
import type { WizardState, WizardStep } from "../wizard-types"

const FIELD_TYPES = ["numeric", "ordinal", "categorical", "multi_response", "identifier", "weight"]

type UploadField = components["schemas"]["UploadFieldOut"]
type FieldType = components["schemas"]["FieldType"]

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
}

export function FieldDetection({ state, setStep }: Props) {
  const [fields, setFields] = useState<UploadField[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!state.sessionId) return
    api
      .GET("/api/v1/uploads/{session_id}", {
        params: { path: { session_id: state.sessionId } },
      })
      .then(({ data }) => {
        if (data) setFields(data.fields)
        setLoading(false)
      })
  }, [state.sessionId])

  async function handleOverride(fieldId: number, overrideType: string | null) {
    const { sessionId } = state
    if (!sessionId) return
    const { data, error } = await mutate(
      () =>
        api.PATCH("/api/v1/uploads/{session_id}/fields/{field_id}", {
          params: { path: { session_id: sessionId, field_id: fieldId } },
          body: { override_type: overrideType as FieldType | null },
        }),
      { errorMessage: "Failed to update field type. Please try again." },
    )
    if (error) return
    if (data) {
      setFields((prev) =>
        prev.map((f) => (f.id === fieldId ? { ...f, override_type: data.override_type } : f)),
      )
    }
  }

  async function handleReset(fieldId: number) {
    await handleOverride(fieldId, null)
  }

  function handleNext() {
    setBusy(true)
    setStep(state.needsReconcile ? 3 : 4)
    setBusy(false)
  }

  if (loading) return <p className="text-muted-foreground text-sm">Loading fields…</p>

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-base text-foreground">Step 2 — Field Detection</h2>
      <p className="text-muted-foreground text-xs">
        Review auto-detected field types. Override any that are wrong.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="field-detection-table">
          <thead>
            <tr className="border-border border-b text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              <th className="pr-3 pb-2">#</th>
              <th className="pr-3 pb-2">Field key</th>
              <th className="pr-3 pb-2">Detected type</th>
              <th className="pr-3 pb-2">Confidence</th>
              <th className="pr-3 pb-2">Sample values</th>
              <th className="pb-2">Override</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr
                key={f.id}
                className="border-border border-b last:border-0"
                data-testid="field-row"
              >
                <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                <td className="py-2 pr-3 font-mono text-xs">{f.field_key}</td>
                <td className="py-2 pr-3">
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-xs">
                    {f.detected_type}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 font-semibold text-xs",
                      f.confidence === "review"
                        ? "bg-[--warning-subtle] text-[--warning-foreground]"
                        : "bg-[--success-subtle] text-[--success-foreground]",
                    ].join(" ")}
                    data-testid="confidence-badge"
                  >
                    {f.confidence}
                  </span>
                </td>
                <td className="py-2 pr-3 text-muted-foreground text-xs">
                  {(f.value_sample ?? []).slice(0, 5).join(", ") || "—"}
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={f.override_type ?? ""}
                      onChange={(e) => handleOverride(f.id, e.target.value || null)}
                      className="rounded border border-border bg-background px-2 py-1 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                      aria-label={`Override type for ${f.field_key}`}
                    >
                      <option value="">— keep detected —</option>
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {f.override_type && (
                      <button
                        type="button"
                        onClick={() => handleReset(f.id)}
                        className="text-muted-foreground text-xs hover:text-foreground"
                        aria-label={`Reset ${f.field_key} to detected type`}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="rounded-lg border border-border px-5 py-2 font-semibold text-muted-foreground text-sm hover:bg-muted"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={busy}
          className="rounded-lg bg-accent px-6 py-2 font-semibold text-sm text-white disabled:opacity-40"
        >
          {busy ? "…" : "Next →"}
        </button>
      </div>
    </div>
  )
}
