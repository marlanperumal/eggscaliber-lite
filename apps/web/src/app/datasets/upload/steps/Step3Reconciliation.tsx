"use client"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useEffect, useRef, useState } from "react"
import type { WizardState, WizardStep } from "../wizard-types"
import {
  ReconciliationRow,
  type ReconGroup,
  type ReconRow,
  type ReconStatus,
} from "./ReconciliationRow"

const TABS: { key: ReconGroup | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "exact", label: "Exact" },
  { key: "probable", label: "Probable" },
  { key: "new_only", label: "New only" },
  { key: "old_only", label: "Old only" },
]
const PAGE_SIZE = 50
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
}

export function Step3Reconciliation({ state, setStep }: Props) {
  const [triggered, setTriggered] = useState(false)
  const [refDatasetId, setRefDatasetId] = useState<string>("")
  const [activeTab, setActiveTab] = useState<ReconGroup | "all">("all")
  const [rows, setRows] = useState<ReconRow[]>([])
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: showAll ? rows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
  })

  async function triggerReconcile() {
    if (!state.sessionId || !refDatasetId) return
    setBusy(true)
    await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference_dataset_id: Number(refDatasetId) }),
    })
    setTriggered(true)
    fetchPage(null)
    setBusy(false)
  }

  async function fetchPage(cursor: number | null) {
    if (!state.sessionId) return
    setLoading(true)
    const params = new URLSearchParams({ page_size: String(PAGE_SIZE) })
    if (activeTab !== "all") params.set("group", activeTab)
    if (cursor !== null) params.set("after_id", String(cursor))
    const res = await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/reconcile?${params}`)
    const data = await res.json()
    setRows((prev) => (cursor === null ? data.items : [...prev, ...data.items]))
    setNextCursor(data.next_cursor ?? null)
    setLoading(false)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchPage intentionally excluded
  useEffect(() => {
    if (triggered) fetchPage(null)
  }, [activeTab, triggered])

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchPage intentionally excluded
  useEffect(() => {
    if (!showAll || !nextCursor) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) fetchPage(nextCursor)
    })
    if (sentinelRef.current) obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [showAll, nextCursor])

  async function handleAction(rowId: number, action: "confirm" | "reject" | "exclude" | "map") {
    const statusMap: Record<string, ReconStatus> = {
      confirm: "confirmed",
      reject: "rejected",
      exclude: "excluded",
    }
    const status = statusMap[action] as ReconStatus
    await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/reconcile/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, status } : r)))
  }

  function handleCheck(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  const pendingCount = rows.filter(
    (r) => (r.group === "probable" || r.group === "old_only") && r.status === "pending",
  ).length

  if (!triggered) {
    return (
      <div className="space-y-4">
        <h2 className="font-semibold text-base text-foreground">Step 3 — Reconciliation</h2>
        <p className="text-muted-foreground text-xs">
          Enter the ID of the reference dataset to reconcile against.
        </p>
        <div>
          <label
            className="mb-1 block font-semibold text-muted-foreground text-xs"
            htmlFor="ref-dataset-id"
          >
            Reference dataset ID
          </label>
          <input
            id="ref-dataset-id"
            value={refDatasetId}
            onChange={(e) => setRefDatasetId(e.target.value)}
            placeholder="Reference dataset ID"
            className="rounded border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <button
          type="button"
          onClick={triggerReconcile}
          disabled={!refDatasetId || busy}
          className="rounded-lg bg-accent px-6 py-2 font-semibold text-sm text-white disabled:opacity-40"
        >
          {busy ? "Running…" : "Run reconciliation →"}
        </button>
        <div className="flex justify-start pt-2">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="rounded-lg border border-border px-5 py-2 font-semibold text-muted-foreground text-sm hover:bg-muted"
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base text-foreground">Step 3 — Reconciliation</h2>

      {/* Tabs */}
      <div className="flex border-border border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as ReconGroup | "all")}
            className={[
              "px-4 py-2 font-semibold text-xs",
              activeTab === tab.key
                ? "border-accent border-b-2 text-accent"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pagination controls at top */}
      <div className="flex items-center gap-3 text-muted-foreground text-xs">
        <span>{rows.length} loaded</span>
        {nextCursor && !showAll && (
          <button
            type="button"
            onClick={() => fetchPage(nextCursor)}
            className="font-semibold text-accent hover:underline"
          >
            Load more
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="font-semibold text-accent hover:underline"
        >
          {showAll ? "Paginate" : "Show all"}
        </button>
        {loading && <span>Loading…</span>}
      </div>

      {/* Row list — virtual when showAll, plain list otherwise */}
      {showAll ? (
        <div
          ref={parentRef}
          className="relative max-h-96 overflow-auto"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((vi) => (
            <div key={vi.key} style={{ position: "absolute", top: vi.start, width: "100%" }}>
              <ReconciliationRow
                row={rows[vi.index]}
                checked={selected.has(rows[vi.index].id)}
                onCheck={handleCheck}
                onAction={handleAction}
              />
            </div>
          ))}
          <div ref={sentinelRef} className="h-1" />
        </div>
      ) : (
        <div>
          {rows.map((row) => (
            <ReconciliationRow
              key={row.id}
              row={row}
              checked={selected.has(row.id)}
              onCheck={handleCheck}
              onAction={handleAction}
            />
          ))}
        </div>
      )}

      {pendingCount > 0 && (
        <p className="font-semibold text-amber-600 text-xs">
          {pendingCount} row{pendingCount > 1 ? "s" : ""} still need a decision before proceeding.
        </p>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="rounded-lg border border-border px-5 py-2 font-semibold text-muted-foreground text-sm hover:bg-muted"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => setStep(4)}
          disabled={pendingCount > 0}
          className="rounded-lg bg-accent px-6 py-2 font-semibold text-sm text-white disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
