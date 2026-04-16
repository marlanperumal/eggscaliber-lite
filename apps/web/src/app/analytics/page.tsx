"use client"
import { useFeatureFlag } from "@posthog/next"
import { notFound } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { AnalyticsLayout } from "./AnalyticsLayout"

const loadingFallback = (
  <div className="flex h-screen items-center justify-center">
    <p className="text-muted-foreground text-sm">Loading…</p>
  </div>
)

function AnalyticsPageInner() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const showAnalytics = useFeatureFlag("analytics-engine")

  if (!mounted) return loadingFallback
  if (showAnalytics === undefined) return loadingFallback
  if (!showAnalytics.enabled) notFound()
  return <AnalyticsLayout />
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <AnalyticsPageInner />
    </Suspense>
  )
}
