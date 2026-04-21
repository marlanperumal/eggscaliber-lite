"use client"

import type { components } from "@shared/api"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"

type PackageRead = components["schemas"]["PackageRead"]

export function PackagesTab() {
  const [packages, setPackages] = useState<PackageRead[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    api.GET("/api/v1/packages").then(({ data }) => {
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
      <div className="p-4">
        <p className="text-muted-foreground text-sm">
          Collection and dataset composition coming soon.
        </p>
      </div>
    </div>
  )
}
