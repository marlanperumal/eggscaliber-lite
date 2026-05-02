"use client"
import { notFound } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { useFeatureFlag } from "@/lib/use-feature-flag"
import { AIChatPage } from "./AIChatPage"

const loadingFallback = (
  <div className="flex h-screen items-center justify-center">
    <p className="text-muted-foreground text-sm">Loading…</p>
  </div>
)

function AIPageInner() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const showAI = useFeatureFlag("ai-interface")

  if (!mounted) return loadingFallback
  if (showAI === undefined) return loadingFallback
  if (!showAI.enabled) notFound()
  return <AIChatPage />
}

export default function AIPage() {
  return (
    <Suspense fallback={loadingFallback}>
      <AIPageInner />
    </Suspense>
  )
}
