"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"

type DatasetItem = {
  id: number
  name: string
  collection_id: number
  collected_at: string | null
  created_at: string
}

export function DatasetsPage() {
  const [items, setItems] = useState<DatasetItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.GET("/api/v1/datasets" as never).then(({ data }: any) => {
      if (data) setItems(data.items)
      setLoading(false)
    })
  }, [])

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

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : items.length === 0 ? (
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
              <th className="pr-4 pb-2">Collected</th>
              <th className="pr-4 pb-2">Uploaded</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr
                key={d.id}
                className="border-border border-b last:border-0"
                data-testid="dataset-row"
              >
                <td className="py-3 pr-4 font-medium text-foreground">{d.name}</td>
                <td className="py-3 pr-4 text-muted-foreground">{d.collected_at ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {new Date(d.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/datasets/upload?session=resume&dataset=${d.id}`}
                    className="font-semibold text-accent text-xs hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
