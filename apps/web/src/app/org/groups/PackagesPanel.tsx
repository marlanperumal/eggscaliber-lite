"use client"

import { useOrganization } from "@clerk/nextjs"
import type { components } from "@shared/api"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"

type PackageRead = components["schemas"]["PackageRead"]
type GroupPackageRead = components["schemas"]["GroupPackageRead"]

interface Props {
  groupId: number | null
}

export function PackagesPanel({ groupId }: Props) {
  const { membership } = useOrganization()
  const isAdmin = membership?.role === "org:admin"

  const [orgPackages, setOrgPackages] = useState<PackageRead[]>([])
  const [groupPackageIds, setGroupPackageIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    api.GET("/api/v1/org/subscriptions").then(({ data }) => {
      if (data) setOrgPackages(data)
    })
  }, [])

  useEffect(() => {
    if (!groupId) {
      setGroupPackageIds(new Set())
      return
    }
    setIsLoading(true)
    api
      .GET("/api/v1/groups/{group_id}/packages", {
        params: { path: { group_id: groupId } },
      })
      .then(({ data }) => {
        if (data) setGroupPackageIds(new Set((data as GroupPackageRead[]).map((p) => p.package_id)))
      })
      .finally(() => setIsLoading(false))
  }, [groupId])

  const togglePackage = async (packageId: number) => {
    if (!groupId) return
    if (groupPackageIds.has(packageId)) {
      await api.DELETE("/api/v1/groups/{group_id}/packages/{package_id}", {
        params: { path: { group_id: groupId, package_id: packageId } },
      })
      setGroupPackageIds((prev) => {
        const s = new Set(prev)
        s.delete(packageId)
        return s
      })
    } else {
      await api.POST("/api/v1/groups/{group_id}/packages", {
        params: { path: { group_id: groupId } },
        body: { package_id: packageId },
      })
      setGroupPackageIds((prev) => new Set([...prev, packageId]))
    }
  }

  if (!groupId) {
    return (
      <div
        data-testid="packages-panel"
        className="flex items-center justify-center rounded-lg border border-border bg-card"
      >
        <p className="text-muted-foreground text-sm opacity-60">Select a group to view packages</p>
      </div>
    )
  }

  return (
    <div
      data-testid="packages-panel"
      className="flex flex-col rounded-lg border border-border bg-card"
    >
      <div className="border-border border-b px-4 py-3">
        <h3 className="font-semibold text-foreground text-sm">Package Access</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="px-4 py-3 text-muted-foreground text-sm">Loading…</p>}
        {!isLoading && orgPackages.length === 0 && (
          <p className="px-4 py-3 text-muted-foreground text-sm">
            No packages available for this org
          </p>
        )}
        {orgPackages.map((pkg) => {
          const granted = groupPackageIds.has(pkg.id)
          return (
            <div
              key={pkg.id}
              data-testid="package-row"
              className="flex items-center justify-between border-border border-b px-4 py-3"
            >
              <div>
                <p className="text-foreground text-sm">{pkg.name}</p>
                <p className="text-muted-foreground text-xs capitalize">{pkg.visibility}</p>
              </div>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => togglePackage(pkg.id)}
                  className={`shrink-0 rounded px-2 py-1 text-xs ${
                    granted ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {granted ? "Granted" : "Grant"}
                </button>
              ) : (
                <span
                  className={`shrink-0 rounded px-2 py-1 text-xs ${
                    granted ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {granted ? "Granted" : "No access"}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
