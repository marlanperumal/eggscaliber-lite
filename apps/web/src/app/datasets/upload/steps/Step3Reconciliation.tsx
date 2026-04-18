"use client"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"
import type { WizardState, WizardStep } from "../wizard-types"
import type { FieldNode, GroupNode } from "./FieldTree"
import {
  ReconciliationRow,
  type ReconGroup,
  type ReconRow,
  type ReconStatus,
} from "./ReconciliationRow"

const TABS: { key: ReconGroup; label: string }[] = [
  { key: "exact", label: "Exact" },
  { key: "probable", label: "Probable" },
  { key: "new_only", label: "New only" },
  { key: "old_only", label: "Old only" },
]
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
}

type Counts = Record<ReconGroup, number>

export function Step3Reconciliation({ state, setStep }: Props) {
  const [triggered, setTriggered] = useState(false)
  const [refDatasetId, setRefDatasetId] = useState<string>("")
  const [refDatasetName, setRefDatasetName] = useState<string>("")
  const [activeTab, setActiveTab] = useState<ReconGroup>("exact")
  const [rows, setRows] = useState<ReconRow[]>([])
  const [counts, setCounts] = useState<Counts>({ exact: 0, probable: 0, new_only: 0, old_only: 0 })
  const [blockingPending, setBlockingPending] = useState(0)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(50)
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploadFields, setUploadFields] = useState<FieldNode[]>([])
  const [uploadGroups, setUploadGroups] = useState<GroupNode[]>([])
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: showAll ? rows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
  })

  // Auto-fetch suggested reference when the step mounts; also populate field tree if already triggered
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchFieldTree intentionally excluded (stable reference)
  useEffect(() => {
    if (!state.sessionId) return
    api
      .GET("/api/v1/uploads/{session_id}/suggested-reference", {
        params: { path: { session_id: state.sessionId } },
      })
      .then(({ data }) => {
        if ((data as any)?.dataset_id) {
          setRefDatasetId(String((data as any).dataset_id))
          setRefDatasetName((data as any).dataset_name ?? "")
        }
      })
    if (triggered) fetchFieldTree()
  }, [state.sessionId, triggered])

  async function fetchCounts() {
    if (!state.sessionId) return
    const { data } = await api.GET("/api/v1/uploads/{session_id}/reconcile/counts", {
      params: { path: { session_id: state.sessionId! } },
    })
    setCounts(data as any)
    setBlockingPending((data as any).blocking_pending ?? 0)
  }

  async function fetchFieldTree() {
    if (!state.sessionId) return
    const { data } = await api.GET("/api/v1/uploads/{session_id}/field-tree", {
      params: { path: { session_id: state.sessionId! } },
    })
    const allFields: FieldNode[] = [
      ...((data as any).fields ?? []),
      ...((data as any).unassigned_fields ?? []),
    ]
    setUploadFields(allFields)
    setUploadGroups((data as any).groups ?? [])
  }

  async function triggerReconcile() {
    if (!state.sessionId || !refDatasetId) return
    setBusy(true)
    await api.POST("/api/v1/uploads/{session_id}/reconcile", {
      params: { path: { session_id: state.sessionId! } },
      body: { reference_dataset_id: Number(refDatasetId) },
    })
    setTriggered(true)
    await fetchCounts()
    await fetchFieldTree()
    fetchPage(null)
    setBusy(false)
  }

  async function fetchPage(cursor: number | null) {
    if (!state.sessionId) return
    setLoading(true)
    const { data } = await api.GET("/api/v1/uploads/{session_id}/reconcile", {
      params: {
        path: { session_id: state.sessionId! },
        query: { group: activeTab, page_size: pageSize, after_id: cursor ?? undefined },
      },
    })
    setRows((prev) => (cursor === null ? (data as any).items : [...prev, ...(data as any).items]))
    setNextCursor((data as any).next_cursor ?? null)
    setLoading(false)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchPage intentionally excluded
  useEffect(() => {
    if (triggered) {
      setRows([])
      setSelected(new Set())
      fetchPage(null)
    }
  }, [activeTab, triggered, pageSize])

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
    await api.PATCH("/api/v1/uploads/{session_id}/reconcile/{row_id}", {
      params: { path: { session_id: state.sessionId!, row_id: rowId } },
      body: { status },
    })
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, status } : r)))
    await fetchCounts()
  }

  async function handleBulkAction(action: ReconStatus) {
    if (!state.sessionId || selected.size === 0) return
    setBusy(true)
    await api.POST("/api/v1/uploads/{session_id}/reconcile/bulk", {
      params: { path: { session_id: state.sessionId! } },
      body: { ids: Array.from(selected), action },
    })
    setRows((prev) => prev.map((r) => (selected.has(r.id) ? { ...r, status: action } : r)))
    setSelected(new Set())
    await fetchCounts()
    setBusy(false)
  }

  function handleCheck(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  if (!triggered) {
    return (
      <div className="space-y-4">
        <h2 className="font-semibold text-base text-foreground">Step 3 — Reconciliation</h2>
        <p className="text-muted-foreground text-xs">
          Comparing against the most recent dataset in this collection.
          {refDatasetName && (
            <span className="ml-1 font-semibold text-foreground">{refDatasetName}</span>
          )}
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

      {/* Tabs with count badges */}
      <div className="flex border-border border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              "flex items-center gap-1.5 px-4 py-2 font-semibold text-xs",
              activeTab === tab.key
                ? "border-accent border-b-2 text-accent"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
            <span
              className={[
                "rounded-full px-1.5 py-0.5 text-xs",
                activeTab === tab.key
                  ? "bg-accent/20 text-accent"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Bulk actions toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="font-semibold text-foreground">{selected.size} selected</span>
          {activeTab === "probable" && (
            <>
              <button
                type="button"
                onClick={() => handleBulkAction("confirmed")}
                disabled={busy}
                className="rounded bg-[--success-subtle] px-2 py-1 font-semibold text-[--success-foreground] hover:bg-[--success]/20"
              >
                Confirm all
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("rejected")}
                disabled={busy}
                className="rounded bg-muted px-2 py-1 font-semibold hover:bg-muted/60"
              >
                Reject all
              </button>
            </>
          )}
          {activeTab === "old_only" && (
            <button
              type="button"
              onClick={() => handleBulkAction("excluded")}
              disabled={busy}
              className="rounded bg-muted px-2 py-1 font-semibold hover:bg-muted/60"
            >
              Exclude all
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* Pagination controls */}
      <div className="flex items-center gap-3 text-muted-foreground text-xs">
        <span>{rows.length} loaded</span>
        <label className="flex items-center gap-1">
          Page size
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
            }}
            className="rounded border border-border bg-background px-1 py-0.5 text-xs"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
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

      {/* Row list */}
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
                fields={uploadFields}
                groups={uploadGroups}
                sessionId={state.sessionId}
                onResolved={async () => {
                  await fetchCounts()
                  fetchPage(null)
                }}
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
              fields={uploadFields}
              groups={uploadGroups}
              sessionId={state.sessionId}
              onResolved={async () => {
                await fetchCounts()
                fetchPage(null)
              }}
            />
          ))}
        </div>
      )}

      {blockingPending > 0 && (
        <p className="font-semibold text-[--warning-foreground] text-xs">
          {blockingPending} row{blockingPending > 1 ? "s" : ""} still need a decision before
          proceeding.
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
          disabled={blockingPending > 0}
          className="rounded-lg bg-accent px-6 py-2 font-semibold text-sm text-white disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
