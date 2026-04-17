"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { WizardState, WizardStep } from "../wizard-types"

const FIELD_TYPES = ["numeric", "ordinal", "categorical", "multi_response", "identifier", "weight"]

interface DetectedField {
  id: number
  field_key: string
  detected_type: string
  override_type: string | null
  sort_order: number
}

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
}

export function Step2FieldDetection({ state, setStep }: Props) {
  const [fields, setFields] = useState<DetectedField[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!state.sessionId) return // Cast: endpoint not yet in generated types — use `as never`
    ;(api.GET as any)(`/api/v1/uploads/${state.sessionId}`).then(({ data }: any) => {
      if (data) setFields(data.fields)
      setLoading(false)
    })
  }, [state.sessionId])

  async function handleOverride(fieldId: number, overrideType: string | null) {
    if (!state.sessionId) return
    const res: any = await (api.PATCH as any)(
      `/api/v1/uploads/${state.sessionId}/fields/${fieldId}`,
      { body: { override_type: overrideType } },
    )
    if (res.data) {
      setFields((prev) =>
        prev.map((f) => (f.id === fieldId ? { ...f, override_type: res.data.override_type } : f)),
      )
    }
  }

  async function handleNext() {
    if (!state.sessionId) return
    setBusy(true)
    if (state.needsReconcile) {
      setStep(3)
    } else {
      setStep(4)
    }
    setBusy(false)
  }

  if (loading) return <p className="text-muted-foreground text-sm">Loading fields…</p>

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-base text-foreground">Step 2 — Field Detection</h2>
      <p className="text-muted-foreground text-xs">
        Review auto-detected field types. Override any that are wrong.
      </p>

      <table className="w-full text-sm" data-testid="field-detection-table">
        <thead>
          <tr className="border-border border-b text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            <th className="pr-4 pb-2">#</th>
            <th className="pr-4 pb-2">Field key</th>
            <th className="pr-4 pb-2">Detected type</th>
            <th className="pb-2">Override</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={f.id} className="border-border border-b last:border-0" data-testid="field-row">
              <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
              <td className="py-2 pr-4 font-mono text-xs">{f.field_key}</td>
              <td className="py-2 pr-4">
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-xs">
                  {f.detected_type}
                </span>
              </td>
              <td className="py-2">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
