"use client"

import type { components } from "@shared/api"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"

type PackageRead = components["schemas"]["PackageRead"]
type PackageCollectionDetail = components["schemas"]["PackageCollectionDetail"]
type CollectionRead = components["schemas"]["CollectionRead"]
type DatasetListItem = components["schemas"]["DatasetListItem"]

export function PackagesTab() {
  const [packages, setPackages] = useState<PackageRead[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    api.GET("/api/v1/admin/packages").then(({ data }) => {
      if (data) {
        setPackages(data)
        if (data.length > 0) setSelectedPackageId(data[0].id)
      }
    })
  }, [])

  const filtered = packages.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div data-testid="packages-tab" className="flex gap-4">
      <div className="flex w-52 shrink-0 flex-col rounded-lg border border-border bg-card">
        <div className="border-border border-b p-2">
          <Input
            placeholder="Search packages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <div className="flex-1 overflow-auto">
          {filtered.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              data-testid={`package-row-${pkg.id}`}
              onClick={() => setSelectedPackageId(pkg.id)}
              className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
                selectedPackageId === pkg.id
                  ? "bg-primary/10 font-semibold text-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <span className="truncate text-sm">{pkg.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{pkg.slug}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-muted-foreground text-xs">
              {search ? "No matches" : "No packages"}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col rounded-lg border border-border bg-card">
        {selectedPackageId ? (
          <PackageCompositionPanel packageId={selectedPackageId} packages={packages} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">Select a package</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface CompositionPanelProps {
  packageId: number
  packages: PackageRead[]
}

function PackageCompositionPanel({ packageId, packages }: CompositionPanelProps) {
  const pkg = packages.find((p) => p.id === packageId)

  const [linked, setLinked] = useState<PackageCollectionDetail[]>([])
  const [allCols, setAllCols] = useState<CollectionRead[]>([])
  const [colDatasets, setColDatasets] = useState<Record<number, DatasetListItem[]>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      const [linkedRes, allColsRes] = await Promise.all([
        api.GET("/api/v1/admin/packages/{package_id}/collections", {
          params: { path: { package_id: packageId } },
        }),
        api.GET("/api/v1/admin/collections"),
      ])
      if (!cancelled) {
        if (linkedRes.data) setLinked(linkedRes.data)
        if (allColsRes.data) setAllCols(allColsRes.data)
        setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [packageId])

  const fetchColDatasets = async (collectionId: number) => {
    if (colDatasets[collectionId]) return
    const { data } = await api.GET("/api/v1/datasets", {
      params: { query: { collection_id: collectionId } },
    })
    if (data) setColDatasets((prev) => ({ ...prev, [collectionId]: data.items }))
  }

  const toggleCollection = async (colId: number, included: boolean) => {
    if (included) {
      await api.DELETE("/api/v1/admin/packages/{package_id}/collections/{collection_id}", {
        params: { path: { package_id: packageId, collection_id: colId } },
      })
      setLinked((prev) => prev.filter((c) => c.collection_id !== colId))
    } else {
      const { data } = await api.POST("/api/v1/admin/packages/{package_id}/collections", {
        params: { path: { package_id: packageId } },
        body: { collection_id: colId, scope: "all" },
      })
      if (data) setLinked((prev) => [...prev, data])
    }
  }

  const updateScope = async (colId: number, scope: "all" | "selected") => {
    const { data } = await api.PATCH(
      "/api/v1/admin/packages/{package_id}/collections/{collection_id}",
      {
        params: { path: { package_id: packageId, collection_id: colId } },
        body: { scope },
      },
    )
    if (data) {
      setLinked((prev) => prev.map((c) => (c.collection_id === colId ? data : c)))
      if (scope === "selected") fetchColDatasets(colId)
    }
  }

  const toggleDataset = async (colId: number, datasetId: number, included: boolean) => {
    if (included) {
      await api.DELETE(
        "/api/v1/admin/packages/{package_id}/collections/{collection_id}/datasets/{dataset_id}",
        {
          params: {
            path: { package_id: packageId, collection_id: colId, dataset_id: datasetId },
          },
        },
      )
    } else {
      await api.POST("/api/v1/admin/packages/{package_id}/collections/{collection_id}/datasets", {
        params: { path: { package_id: packageId, collection_id: colId } },
        body: { dataset_id: datasetId },
      })
    }
    const { data } = await api.GET("/api/v1/admin/packages/{package_id}/collections", {
      params: { path: { package_id: packageId } },
    })
    if (data) setLinked(data)
  }

  const linkedIds = new Set(linked.map((c) => c.collection_id))

  return (
    <div data-testid="package-composition-panel">
      <div className="flex items-center gap-3 border-border border-b px-4 py-3">
        <div className="min-w-0">
          <span className="font-semibold text-foreground text-sm">{pkg?.name}</span>
          {pkg && (
            <Badge
              variant={pkg.visibility === "private" ? "secondary" : "outline"}
              className="ml-2 text-[10px]"
            >
              {pkg.visibility}
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="p-4 text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <h3 className="font-medium text-foreground text-sm">Collections</h3>
          {allCols.length === 0 && (
            <p className="text-muted-foreground text-sm">No collections exist yet</p>
          )}
          {allCols.map((col) => {
            const included = linkedIds.has(col.id)
            const detail = linked.find((c) => c.collection_id === col.id)
            const datasets = colDatasets[col.id] ?? []

            return (
              <div
                key={col.id}
                data-testid="collection-row"
                className="flex flex-col gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">{col.name}</p>
                    <p className="text-muted-foreground text-xs">{col.collection_type}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCollection(col.id, included)}
                    className={`shrink-0 rounded px-2 py-1 text-xs ${
                      included ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {included ? "Included" : "Include"}
                  </button>
                </div>

                {included && detail && (
                  <div className="flex flex-col gap-2 pl-2">
                    <div className="flex items-center gap-2">
                      <label htmlFor={`scope-${col.id}`} className="text-muted-foreground text-xs">
                        Scope:
                      </label>
                      <select
                        id={`scope-${col.id}`}
                        value={detail.scope}
                        onChange={(e) => updateScope(col.id, e.target.value as "all" | "selected")}
                        className="rounded border border-border bg-background px-1 py-0.5 text-foreground text-xs"
                      >
                        <option value="all">All datasets</option>
                        <option value="selected">Selected datasets</option>
                      </select>
                    </div>

                    {detail.scope === "selected" && (
                      <div className="flex flex-col gap-1">
                        <p className="text-muted-foreground text-xs">Datasets:</p>
                        {datasets.length === 0 && (
                          <button
                            type="button"
                            onClick={() => fetchColDatasets(col.id)}
                            className="text-left text-foreground text-xs hover:underline"
                          >
                            Load datasets
                          </button>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {datasets.map((ds) => {
                            const dsIncluded = detail.dataset_ids.includes(ds.id)
                            return (
                              <button
                                key={ds.id}
                                type="button"
                                onClick={() => toggleDataset(col.id, ds.id, dsIncluded)}
                                className={`rounded-full border px-2 py-0.5 text-xs ${
                                  dsIncluded
                                    ? "border-primary bg-primary/5 text-foreground"
                                    : "border-border text-muted-foreground"
                                }`}
                              >
                                {ds.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
