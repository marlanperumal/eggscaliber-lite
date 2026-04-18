"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import type { WizardState, WizardStep } from "./wizard-types"

export function useWizardState() {
  const router = useRouter()
  const params = useSearchParams()
  const stepParam = Number(params.get("step") ?? "1") as WizardStep

  const [state, setState] = useState<WizardState>({
    step: stepParam,
    sessionId: params.get("session") ? Number(params.get("session")) : null,
    needsReconcile: params.get("reconcile") === "1",
  })

  const setStep = useCallback(
    (step: WizardStep) => {
      setState((prev) => ({ ...prev, step }))
      const p = new URLSearchParams(params.toString())
      p.set("step", String(step))
      router.push(`/datasets/upload?${p.toString()}`)
    },
    [params, router],
  )

  const setSessionId = useCallback(
    (id: number) => {
      setState((prev) => ({ ...prev, sessionId: id }))
      const p = new URLSearchParams(params.toString())
      p.set("session", String(id))
      router.replace(`/datasets/upload?${p.toString()}`)
    },
    [params, router],
  )

  const setNeedsReconcile = useCallback(
    (v: boolean) => {
      setState((prev) => ({ ...prev, needsReconcile: v }))
      const p = new URLSearchParams(params.toString())
      if (v) {
        p.set("reconcile", "1")
      } else {
        p.delete("reconcile")
      }
      router.replace(`/datasets/upload?${p.toString()}`)
    },
    [params, router],
  )

  return { state, setStep, setSessionId, setNeedsReconcile }
}
