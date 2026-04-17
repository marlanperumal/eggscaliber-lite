import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useWizardState } from "./useWizardState"

// Mock Next.js router and searchParams
const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () => new URLSearchParams("step=1"),
}))

describe("useWizardState", () => {
  beforeEach(() => pushMock.mockClear())

  it("starts at step 1 with no session", () => {
    const { result } = renderHook(() => useWizardState())
    expect(result.current.state.step).toBe(1)
    expect(result.current.state.sessionId).toBeNull()
  })

  it("setStep updates URL", () => {
    const { result } = renderHook(() => useWizardState())
    act(() => result.current.setStep(2))
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("step=2"))
  })

  it("setSessionId stores id in state", () => {
    const { result } = renderHook(() => useWizardState())
    act(() => result.current.setSessionId(42))
    expect(result.current.state.sessionId).toBe(42)
  })
})
