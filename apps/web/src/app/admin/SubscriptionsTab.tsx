"use client"

import type { components } from "@shared/api"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"

type PackageRead = components["schemas"]["PackageRead"]
type OrgSubscriptionRead = components["schemas"]["OrgSubscriptionRead"]

interface Props {
  orgId: number | null
}

interface SubscriptionState {
  subscribed: boolean
  startDate: string
  endDate: string
  /** The existing subscription id if subscribed */
  subId?: number
}

export function SubscriptionsTab({ orgId }: Props) {
  const [packages, setPackages] = useState<PackageRead[]>([])
  const [subStates, setSubStates] = useState<Record<number, SubscriptionState>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.GET("/api/v1/packages").then(({ data }) => {
      if (data) setPackages(data)
    })
  }, [])

  useEffect(() => {
    if (orgId === null) return
    setLoading(true)
    api
      .GET("/api/v1/admin/orgs/{org_id}/subscriptions", {
        params: { path: { org_id: orgId } },
      })
      .then(({ data }) => {
        const states: Record<number, SubscriptionState> = {}
        if (data) {
          for (const sub of data) {
            states[sub.package_id] = {
              subscribed: true,
              startDate: sub.start_date,
              endDate: sub.end_date ?? "",
              subId: sub.id,
            }
          }
        }
        setSubStates(states)
        setLoading(false)
      })
  }, [orgId])

  async function toggleSubscription(pkg: PackageRead) {
    if (orgId === null) return
    const current = subStates[pkg.id]
    if (current?.subscribed) {
      await api.DELETE("/api/v1/admin/orgs/{org_id}/subscriptions/{package_id}", {
        params: { path: { org_id: orgId, package_id: pkg.id } },
      })
      setSubStates((prev) => {
        const next = { ...prev }
        delete next[pkg.id]
        return next
      })
    } else {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await api.POST("/api/v1/admin/orgs/{org_id}/subscriptions", {
        params: { path: { org_id: orgId } },
        body: { package_id: pkg.id, start_date: today, end_date: null },
      })
      if (data) {
        setSubStates((prev) => ({
          ...prev,
          [pkg.id]: {
            subscribed: true,
            startDate: data.start_date,
            endDate: data.end_date ?? "",
            subId: data.id,
          },
        }))
      }
    }
  }

  if (!orgId) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-muted-foreground text-sm">Select an organisation</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div role="status" aria-label="Loading" className="text-muted-foreground text-sm">
          Loading…
        </div>
      </div>
    )
  }

  return (
    <div data-testid="subscriptions-tab" className="rounded-lg border border-border bg-card">
      <div className="grid grid-cols-[1fr_90px_110px_110px] gap-2 border-border border-b bg-muted px-4 py-2">
        <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
          Package
        </span>
        <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
          Subscribed
        </span>
        <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
          Start Date
        </span>
        <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
          End Date
        </span>
      </div>

      {packages.map((pkg, i) => {
        const state = subStates[pkg.id]
        const isSubscribed = state?.subscribed ?? false
        const rowBg = i % 2 === 1 ? "bg-muted/40" : ""
        return (
          <div
            key={pkg.id}
            data-testid={`subscription-row-${pkg.id}`}
            className={`grid grid-cols-[1fr_90px_110px_110px] items-center gap-2 border-border border-b px-4 py-2 last:border-b-0 ${rowBg}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-foreground text-sm">{pkg.name}</span>
              <Badge
                variant={pkg.visibility === "private" ? "secondary" : "outline"}
                className="shrink-0 text-[10px]"
              >
                {pkg.visibility}
              </Badge>
            </div>

            <div className="flex items-center">
              <button
                type="button"
                onClick={() => toggleSubscription(pkg)}
                aria-pressed={isSubscribed}
                aria-label={`${isSubscribed ? "Unsubscribe" : "Subscribe"} ${pkg.name}`}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  isSubscribed ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none block h-4 w-4 rounded-full bg-card shadow-sm transition-transform ${
                    isSubscribed ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div>
              <Input
                type="date"
                value={state?.startDate ?? ""}
                disabled={!isSubscribed}
                aria-label={`Start date for ${pkg.name}`}
                className="h-7 px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                onChange={(e) => {
                  setSubStates((prev) => ({
                    ...prev,
                    [pkg.id]: {
                      ...(prev[pkg.id] ?? { subscribed: true, endDate: "" }),
                      startDate: e.target.value,
                    },
                  }))
                }}
              />
            </div>

            <div>
              <Input
                type="date"
                value={state?.endDate ?? ""}
                disabled={!isSubscribed}
                aria-label={`End date for ${pkg.name}`}
                className="h-7 px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                onChange={(e) => {
                  setSubStates((prev) => ({
                    ...prev,
                    [pkg.id]: {
                      ...(prev[pkg.id] ?? { subscribed: true, startDate: "" }),
                      endDate: e.target.value,
                    },
                  }))
                }}
              />
            </div>
          </div>
        )
      })}

      {packages.length === 0 && (
        <div className="flex h-24 items-center justify-center">
          <p className="text-muted-foreground text-sm">No packages found</p>
        </div>
      )}
    </div>
  )
}
