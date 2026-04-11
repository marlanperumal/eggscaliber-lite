"use client"
import { useFeatureFlag } from "@posthog/next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { AnalyticsLayout } from "./AnalyticsLayout"

function AnalyticsPageInner() {
  const showAnalytics = useFeatureFlag("analytics-engine")
  if (showAnalytics === false || showAnalytics === null) notFound()
  if (showAnalytics === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }
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
