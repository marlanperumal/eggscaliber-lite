"use client"
import { useFeatureFlag as posthogUseFeatureFlag } from "@posthog/next"
import { useEffect, useState } from "react"

const isPostHogEnabled = (process.env.NEXT_PUBLIC_POSTHOG_KEY?.length ?? 0) > 20

// Dev-mode flag overrides via localStorage (no PostHog required).
// Enable:  localStorage.setItem("devFlags", JSON.stringify({ "ai-interface": true }))
// Disable: localStorage.setItem("devFlags", JSON.stringify({ "ai-interface": false }))
// Clear:   localStorage.removeItem("devFlags")
function useFeatureFlagDev(flag: string): { key: string; enabled: boolean } | undefined {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("devFlags")
      setEnabled(stored ? ((JSON.parse(stored) as Record<string, boolean>)[flag] ?? false) : false)
    } catch {
      setEnabled(false)
    }
  }, [flag])

  if (enabled === undefined) return undefined
  return { key: flag, enabled }
}

function useFeatureFlagPostHog(flag: string): { key: string; enabled: boolean } | undefined {
  const result = posthogUseFeatureFlag(flag)
  if (!result) return undefined
  return { key: result.key, enabled: result.enabled }
}

// Assigned at module-evaluation time — same function on every render for a given build.
export const useFeatureFlag: (flag: string) => { key: string; enabled: boolean } | undefined =
  isPostHogEnabled ? useFeatureFlagPostHog : useFeatureFlagDev
