"use client"
import { useFeatureFlag } from "@posthog/next"
import { notFound } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { AnalyticsLayout } from "./AnalyticsLayout"

const loadingFallback = (
  <div className="flex h-screen items-center justify-center">
    <p className="text-sm text-muted-foreground">Loading…</p>
  </div>
)

function AnalyticsPageInner() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const showAnalytics = useFeatureFlag("analytics-engine")

  if (!mounted) return loadingFallback
  if (showAnalytics === false || showAnalytics === null) notFound()
  if (showAnalytics === undefined) return loadingFallback
  return <AnalyticsLayout />
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <AnalyticsPageInner />
    </Suspense>
  )
}
