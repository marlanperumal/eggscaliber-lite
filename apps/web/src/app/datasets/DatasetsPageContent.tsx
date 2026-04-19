"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"

export type Package = { id: number; name: string }
export type Collection = { id: number; name: string; package_id?: number }
export type DraftItem = {
  id: number
  status: string
  dataset_name: string | null
  collection_name: string | null
  package_name: string | null
  created_at: string
}
export type DatasetItem = {
  id: number
  name: string
  collection_id: number
  collection_name: string
  package_name: string
  response_count: number
  field_count: number
  collected_at: string | null
  created_at: string
  status: string
}

interface Props {
  initialPackages: Package[]
  initialDrafts: DraftItem[]
  initialDatasets: DatasetItem[]
}

export function DatasetsPageContent({ initialPackages, initialDrafts, initialDatasets }: Props) {
  const [items, setItems] = useState<DatasetItem[]>(initialDatasets)
  const [drafts, setDrafts] = useState<DraftItem[]>(initialDrafts)
  const [packages] = useState<Package[]>(initialPackages)
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string>("")
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  useEffect(() => {
    if (!selectedPackageId) {
      setCollections([])
      setSelectedCollectionId("")
      return
    }
    api
      .GET("/api/v1/packages/{package_id}", {
        params: { path: { package_id: Number(selectedPackageId) } },
      })
      .then(({ data }) => {
        if (data?.collections) setCollections(data.collections)
        setSelectedCollectionId("")
      })
  }, [selectedPackageId])

  useEffect(() => {
    setLoading(true)
    api
      .GET("/api/v1/datasets", {
        params: {
          query: { collection_id: selectedCollectionId ? Number(selectedCollectionId) : undefined },
        },
      })
      .then(({ data }) => {
        if (data) setItems((data as { items: DatasetItem[] }).items)
        setLoading(false)
      })
  }, [selectedCollectionId])

  const filtered = items.filter((d) =>
    search ? d.name.toLowerCase().includes(search.toLowerCase()) : true,
  )

  function resumeUrl(draft: DraftItem): string {
    const stepMap: Record<string, number> = {
      pending: 2,
      detecting: 2,
      reconciling: 3,
      editing: 4,
    }
    const step = stepMap[draft.status] ?? 2
    const reconcile =
      draft.status === "reconciling" || draft.status === "editing" ? "&reconcile=1" : ""
    return `/datasets/upload?session=${draft.id}&step=${step}${reconcile}`
  }

  async function handleDelete(id: number) {
    setDeleteId(null)
    await api.DELETE("/api/v1/datasets/{dataset_id}", {
      params: { path: { dataset_id: id } },
    })
    setItems((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-bold text-2xl text-foreground">Datasets</h1>
        <Link
          href="/datasets/upload"
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-sm text-white hover:opacity-90"
        >
          Upload dataset
        </Link>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={selectedPackageId}
          onChange={(e) => setSelectedPackageId(e.target.value)}
          className="rounded border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Filter by package"
        >
          <option value="">All packages</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={selectedCollectionId}
          onChange={(e) => setSelectedCollectionId(e.target.value)}
          disabled={!selectedPackageId}
          className="rounded border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
          aria-label="Filter by collection"
        >
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="rounded border border-border bg-background px-3 py-1.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Search datasets"
        />
      </div>

      {drafts.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            In progress
          </h2>
          <div className="space-y-2">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-[--warning] bg-[--warning-subtle] px-4 py-3 text-sm"
                data-testid="draft-session-row"
              >
                <div>
                  <span className="font-semibold text-foreground">
                    {d.dataset_name ?? "Untitled upload"}
                  </span>
                  {d.collection_name && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      {d.package_name} › {d.collection_name}
                    </span>
                  )}
                  <span className="ml-2 rounded-full bg-[--warning-subtle] px-2 py-0.5 font-semibold text-[--warning-foreground] text-xs">
                    draft
                  </span>
                </div>
                <div className="flex gap-3">
                  <Link
                    href={resumeUrl(d)}
                    className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-sm text-white hover:opacity-90"
                  >
                    Resume →
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.DELETE("/api/v1/uploads/{session_id}", {
                        params: { path: { session_id: d.id } },
                      })
                      setDrafts((prev) => prev.filter((x) => x.id !== d.id))
                    }}
                    className="font-semibold text-destructive text-xs hover:underline"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border border-dashed py-20 text-center">
          <svg
            className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="font-semibold text-muted-foreground text-sm">
            {search || selectedCollectionId ? "No matching datasets." : "No datasets yet."}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            {search || selectedCollectionId
              ? "Try adjusting your filters."
              : "Upload a CSV to get started."}
          </p>
          {!search && !selectedCollectionId && (
            <Link
              href="/datasets/upload"
              className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 font-semibold text-sm text-white hover:opacity-90"
            >
              Upload your first dataset →
            </Link>
          )}
        </div>
      ) : (
        <table className="w-full text-sm" data-testid="datasets-table">
          <thead>
            <tr className="border-border border-b text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              <th className="pr-4 pb-2">Name</th>
              <th className="pr-4 pb-2">Collection</th>
              <th className="pr-4 pb-2">Package</th>
              <th className="pr-4 pb-2 text-right">Responses</th>
              <th className="pr-4 pb-2 text-right">Fields</th>
              <th className="pr-4 pb-2">Uploaded</th>
              <th className="pr-4 pb-2">Status</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr
                key={d.id}
                className="border-border border-b last:border-0"
                data-testid="dataset-row"
              >
                <td className="py-3 pr-4 font-medium text-foreground">{d.name}</td>
                <td className="py-3 pr-4 text-muted-foreground">{d.collection_name}</td>
                <td className="py-3 pr-4 text-muted-foreground">{d.package_name}</td>
                <td className="py-3 pr-4 text-right text-muted-foreground">{d.response_count}</td>
                <td className="py-3 pr-4 text-right text-muted-foreground">{d.field_count}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {new Date(d.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 pr-4">
                  <span className="rounded-full bg-[--success-subtle] px-2 py-0.5 font-semibold text-[--success-foreground] text-xs">
                    {d.status}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/datasets/${d.id}`}
                      className="font-semibold text-accent text-xs hover:underline"
                    >
                      View
                    </Link>
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/datasets/${d.id}/download`}
                      download={`dataset-${d.id}.csv`}
                      className="rounded border border-border px-3 py-1 text-xs hover:bg-muted"
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => setDeleteId(d.id)}
                      className="font-semibold text-destructive text-xs hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Delete confirmation dialog */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl border border-border bg-background p-6 shadow-xl">
            <p className="mb-4 font-semibold text-sm">
              Delete this dataset? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteId)}
                className="rounded-lg bg-destructive px-4 py-2 font-semibold text-sm text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
