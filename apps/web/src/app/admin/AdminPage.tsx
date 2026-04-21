"use client"

import type { components } from "@shared/api"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { PackagesTab } from "./PackagesTab"
import { SubscriptionsTab } from "./SubscriptionsTab"

type OrganisationRead = components["schemas"]["OrganisationRead"]

export function AdminPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<OrganisationRead[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.GET("/api/v1/admin/orgs").then(({ data, error, response }) => {
      if (response.status === 403) {
        router.push("/analytics")
        return
      }
      if (data) {
        setOrgs(data)
        if (data.length > 0) setSelectedOrgId(data[0].id)
      }
      setLoading(false)
    })
  }, [router])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div role="status" aria-label="Loading" className="text-muted-foreground text-sm">
          Loading…
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border border-b px-6 py-4">
        <h1 className="font-semibold text-foreground text-xl tracking-tight">Admin</h1>
        <p className="text-muted-foreground text-sm">
          Super-user controls — manage organisations, subscriptions, and packages.
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          data-testid="admin-org-sidebar"
          className="w-52 shrink-0 border-border border-r bg-card"
        >
          <div className="border-border border-b px-3 py-3">
            <p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
              Organisations
            </p>
          </div>
          <div className="overflow-auto">
            {orgs.map((org) => (
              <button
                key={org.id}
                type="button"
                data-testid={`admin-org-${org.id}`}
                onClick={() => setSelectedOrgId(org.id)}
                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                  selectedOrgId === org.id
                    ? "bg-primary/10 font-semibold text-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {org.name}
              </button>
            ))}
            {orgs.length === 0 && (
              <p className="px-3 py-4 text-muted-foreground text-xs">No organisations</p>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <Tabs defaultValue="subscriptions" className="flex flex-1 flex-col">
            <TabsList className="w-full justify-start rounded-none border-border border-b bg-transparent px-4">
              <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
              <TabsTrigger value="packages">Packages</TabsTrigger>
            </TabsList>
            <TabsContent value="subscriptions" className="flex-1 p-4">
              <SubscriptionsTab orgId={selectedOrgId} />
            </TabsContent>
            <TabsContent value="packages" className="flex-1 p-4">
              <PackagesTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
