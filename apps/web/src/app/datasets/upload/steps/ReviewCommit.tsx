"use client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { mutate } from "@/lib/mutate"
import type { WizardState, WizardStep } from "../wizard-types"

interface ReconSummary {
  reference_dataset_name: string | null
  exact: number
  confirmed: number
  new_only: number
  excluded: number
}

interface SessionSummary {
  dataset_name: string | null
  row_count: number | null
  collection_id: number | null
  collection_name: string | null
  package_name: string | null
  collected_at: string | null
  file_name: string | null
  fields: { detected_type: string; override_type?: string | null }[]
  groups: { id: number; name: string; parent_id: number | null; field_count: number }[]
  unassigned_fields: unknown[]
  recon: ReconSummary | null
  excluded_field_keys: string[]
}

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
}

export function ReviewCommit({ state, setStep }: Props) {
  const router = useRouter()
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!state.sessionId) return
    Promise.all([
      api
        .GET("/api/v1/uploads/{session_id}", {
          params: { path: { session_id: state.sessionId } },
        })
        .then(({ data }) => data),
      api
        .GET("/api/v1/uploads/{session_id}/field-tree", {
          params: { path: { session_id: state.sessionId } },
        })
        .then(({ data }) => data),
      state.needsReconcile
        ? Promise.all([
            api
              .GET("/api/v1/uploads/{session_id}/reconcile/counts", {
                params: { path: { session_id: state.sessionId } },
              })
              .then(({ data }) => data),
            api
              .GET("/api/v1/uploads/{session_id}/suggested-reference", {
                params: { path: { session_id: state.sessionId } },
              })
              .then(({ data }) => data),
            api
              .GET("/api/v1/uploads/{session_id}/reconcile", {
                params: {
                  path: { session_id: state.sessionId },
                  query: { group: "old_only", page_size: 100 },
                },
              })
              .then(({ data }) => data),
          ])
        : Promise.resolve(null),
    ]).then(([sessRaw, treeRaw, reconData]) => {
      if (!sessRaw || !treeRaw) return
      const sess = sessRaw
      const tree = treeRaw
      let recon: ReconSummary | null = null
      let excludedKeys: string[] = []
      if (reconData) {
        const [counts, suggested, oldOnlyPage] = reconData as [
          Record<string, number | Record<string, number>>,
          { dataset_name: string | null },
          {
            items: Array<{ status: string; field_key: string | null; ref_field_key: string | null }>
          },
        ]
        const statusCounts = (counts.status_counts ?? {}) as Record<string, number>
        recon = {
          reference_dataset_name: suggested.dataset_name,
          exact: (counts.exact as number) ?? 0,
          confirmed: (counts.confirmed as number) ?? 0,
          new_only: (counts.new_only as number) ?? 0,
          excluded: statusCounts.excluded ?? 0,
        }
        excludedKeys = oldOnlyPage.items
          .filter((r) => r.status === "excluded" && r.ref_field_key)
          .map((r) => r.ref_field_key as string)
      }
      setSummary({
        dataset_name: sess.dataset_name,
        row_count: sess.row_count,
        collection_id: sess.collection_id,
        collection_name: sess.collection_name ?? null,
        package_name: sess.package_name ?? null,
        collected_at: sess.collected_at ?? null,
        file_name: sess.file_name ?? null,
        fields: sess.fields,
        groups: tree.groups,
        unassigned_fields: tree.unassigned_fields,
        recon,
        excluded_field_keys: excludedKeys,
      })
      setLoading(false)
    })
  }, [state.sessionId, state.needsReconcile])

  async function handleCommit() {
    const { sessionId } = state
    if (!sessionId) return
    setBusy(true)
    const { error: commitError } = await mutate(
      () =>
        api.POST("/api/v1/uploads/{session_id}/commit", {
          params: { path: { session_id: sessionId } },
        }),
      { errorMessage: "Commit failed. Please try again." },
    )
    if (commitError) {
      setBusy(false)
      return
    }
    router.push("/datasets")
  }

  if (loading || !summary) return <p className="text-muted-foreground text-sm">Loading summary…</p>

  const typeCounts = summary.fields.reduce<Record<string, number>>((acc, f) => {
    const t = f.override_type ?? f.detected_type
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  const topGroups = summary.groups.filter((g) => g.parent_id === null)

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-base text-foreground">Step 5 — Review &amp; Commit</h2>
      <p className="text-muted-foreground text-xs">
        Everything looks good. Review the summary and confirm to write to the database.
      </p>

      {/* Warning box */}
      {summary.excluded_field_keys.length > 0 && (
        <div className="rounded-lg border border-[--warning] bg-[--warning-subtle] px-4 py-3 text-[--warning-foreground] text-xs">
          <p className="mb-1 font-semibold">⚠ Excluded fields from reference dataset</p>
          <p>
            The following fields from the reference dataset are absent in this upload and will not
            be tracked: <span className="font-mono">{summary.excluded_field_keys.join(", ")}</span>
          </p>
        </div>
      )}

      {/* 2×2 summary grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Dataset details */}
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-border border-b bg-muted/40 px-3 py-2 font-bold text-muted-foreground text-xs uppercase tracking-wide">
            Dataset details
            <button
              type="button"
              onClick={() => setStep(1)}
              className="font-semibold text-accent text-xs normal-case"
            >
              ← Edit
            </button>
          </div>
          <div className="space-y-1 px-3 py-2 text-xs">
            <div className="flex gap-2">
              <span className="w-28 text-muted-foreground">Name</span>
              <span className="font-medium">{summary.dataset_name}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 text-muted-foreground">Responses</span>
              <span className="font-medium">{summary.row_count ?? "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 text-muted-foreground">Collection ID</span>
              <span className="font-medium">{summary.collection_id ?? "—"}</span>
            </div>
            {summary.collection_name && (
              <div className="flex gap-2">
                <span className="w-28 text-muted-foreground">Collection</span>
                <span className="font-medium">{summary.collection_name}</span>
              </div>
            )}
            {summary.package_name && (
              <div className="flex gap-2">
                <span className="w-28 text-muted-foreground">Package</span>
                <span className="font-medium">{summary.package_name}</span>
              </div>
            )}
            {summary.collected_at && (
              <div className="flex gap-2">
                <span className="w-28 text-muted-foreground">Collected</span>
                <span className="font-medium">
                  {new Date(summary.collected_at).toLocaleDateString("en-GB")}
                </span>
              </div>
            )}
            {summary.file_name && (
              <div className="flex gap-2">
                <span className="w-28 text-muted-foreground">File</span>
                <span className="font-medium font-mono text-xs">{summary.file_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Fields breakdown */}
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-border border-b bg-muted/40 px-3 py-2 font-bold text-muted-foreground text-xs uppercase tracking-wide">
            Fields
            <button
              type="button"
              onClick={() => setStep(2)}
              className="font-semibold text-accent text-xs normal-case"
            >
              ← Edit
            </button>
          </div>
          <div className="space-y-1 px-3 py-2 text-xs">
            <div className="flex gap-2">
              <span className="w-28 text-muted-foreground">Total</span>
              <span className="font-semibold">{summary.fields.length}</span>
            </div>
            {Object.entries(typeCounts).map(([t, n]) => (
              <div key={t} className="flex gap-2">
                <span className="w-28 text-muted-foreground">{t}</span>
                <span className="font-medium">{n}</span>
              </div>
            ))}
            {/* Mini bar chart */}
            <div className="mt-2 space-y-1">
              {Object.entries(typeCounts).map(([t, n]) => (
                <div key={`bar-${t}`} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-muted-foreground text-xs">{t}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-accent"
                      style={{
                        width: `${summary.fields.length > 0 ? Math.round((n / summary.fields.length) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-muted-foreground text-xs">{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reconciliation summary (only when reconciliation ran) */}
        {summary.recon && (
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-border border-b bg-muted/40 px-3 py-2 font-bold text-muted-foreground text-xs uppercase tracking-wide">
              Reconciliation
              <button
                type="button"
                onClick={() => setStep(3)}
                className="font-semibold text-accent text-xs normal-case"
              >
                ← Edit
              </button>
            </div>
            <div className="space-y-2 px-3 py-2 text-xs">
              {summary.recon.reference_dataset_name && (
                <div className="flex gap-2">
                  <span className="w-24 text-muted-foreground">Reference</span>
                  <span className="font-medium">{summary.recon.reference_dataset_name}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="rounded-full bg-[--success-subtle] px-2 py-0.5 font-semibold text-[--success-foreground] text-xs">
                  ✓ {summary.recon.exact} exact
                </span>
                <span className="rounded-full bg-[--success-subtle] px-2 py-0.5 font-semibold text-[--success-foreground] text-xs">
                  ✓ {summary.recon.confirmed} confirmed
                </span>
                <span className="rounded-full bg-[--info-subtle] px-2 py-0.5 font-semibold text-[--info-foreground] text-xs">
                  + {summary.recon.new_only} new
                </span>
                {summary.recon.excluded > 0 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground text-xs">
                    — {summary.recon.excluded} excluded
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Group structure */}
        <div className={summary.recon ? "" : "col-span-2"}>
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-border border-b bg-muted/40 px-3 py-2 font-bold text-muted-foreground text-xs uppercase tracking-wide">
              Group structure
              <button
                type="button"
                onClick={() => setStep(4)}
                className="font-semibold text-accent text-xs normal-case"
              >
                ← Edit
              </button>
            </div>
            <div className="space-y-1 px-3 py-2 text-xs">
              {topGroups.map((g) => (
                <div key={g.id} className="flex items-center gap-2">
                  <span
                    className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                  <span className="font-medium">{g.name}</span>
                  <span className="text-muted-foreground">
                    ({g.field_count} field{g.field_count !== 1 ? "s" : ""})
                  </span>
                </div>
              ))}
              {summary.unassigned_fields.length > 0 && (
                <div className="flex gap-2 text-muted-foreground italic">
                  <span
                    className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>
                    Unassigned ({summary.unassigned_fields.length} field
                    {summary.unassigned_fields.length !== 1 ? "s" : ""})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Commit panel */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
        <span className="text-3xl" aria-hidden="true">
          🚀
        </span>
        <div className="flex-1">
          <p className="font-bold text-foreground text-sm">Ready to commit</p>
          <p className="text-muted-foreground text-xs">
            This will create <strong>{summary.dataset_name}</strong> with{" "}
            <strong>{summary.row_count ?? "?"} responses</strong> and{" "}
            <strong>{summary.fields.length} fields</strong>. This action cannot be undone —
            responses and fields will be written to the database.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCommit}
          disabled={busy}
          className="shrink-0 rounded-lg bg-accent px-6 py-2.5 font-bold text-sm text-white disabled:opacity-40"
        >
          {busy ? "Committing…" : "Commit dataset →"}
        </button>
      </div>

      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => setStep(4)}
          className="rounded-lg border border-border px-5 py-2 font-semibold text-muted-foreground text-sm hover:bg-muted"
        >
          ← Back to Metadata
        </button>
      </div>
    </div>
  )
}
