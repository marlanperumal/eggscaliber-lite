"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"

type Package = { id: number; name: string }
type Collection = { id: number; name: string; package_id?: number }
type DatasetItem = {
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

export function DatasetsPage() {
  const [items, setItems] = useState<DatasetItem[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string>("")
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  useEffect(() => {
    api.GET("/api/v1/packages" as never).then(({ data }: any) => {
      if (data) setPackages(data)
    })
  }, [])

  useEffect(() => {
    if (!selectedPackageId) {
      setCollections([])
      setSelectedCollectionId("")
      return
    }
    api.GET(`/api/v1/packages/${selectedPackageId}` as never).then(({ data }: any) => {
      if (data?.collections) setCollections(data.collections)
      setSelectedCollectionId("")
    })
  }, [selectedPackageId])

  useEffect(() => {
    setLoading(true)
    const params = selectedCollectionId ? `?collection_id=${selectedCollectionId}` : ""
    api.GET(`/api/v1/datasets${params}` as never).then(({ data }: any) => {
      if (data) setItems(data.items)
      setLoading(false)
    })
  }, [selectedCollectionId])

  const filtered = items.filter((d) =>
    search ? d.name.toLowerCase().includes(search.toLowerCase()) : true,
  )

  async function handleDelete(id: number) {
    setDeleteId(null)
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/datasets/${id}`,
      { method: "DELETE" },
    )
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
          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
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
          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
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
          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Search datasets"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border border-dashed py-16 text-center">
          <p className="font-medium text-muted-foreground text-sm">No datasets yet.</p>
          <Link
            href="/datasets/upload"
            className="mt-3 inline-block font-semibold text-accent text-sm"
          >
            Upload your first dataset →
          </Link>
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
                  <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-800 text-xs">
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
