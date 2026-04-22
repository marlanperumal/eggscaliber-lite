import { render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { useWizardState } from "./useWizardState"
import { WizardShell } from "./WizardShell"
import type { WizardState } from "./wizard-types"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn().mockResolvedValue({ data: [] }), POST: vi.fn(), PATCH: vi.fn() },
}))

vi.mock("./useWizardState", () => ({
  useWizardState: vi.fn(),
}))

function mockState(state: WizardState) {
  vi.mocked(useWizardState).mockReturnValue({
    state,
    setStep: vi.fn(),
    setSessionId: vi.fn(),
    setNeedsReconcile: vi.fn(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

it("renders all 5 step labels when needsReconcile is true", () => {
  mockState({ step: 1, sessionId: null, needsReconcile: true })
  render(<WizardShell />)
  expect(screen.getByText(/1\. File & Hierarchy/)).toBeInTheDocument()
  expect(screen.getByText(/2\. Field Detection/)).toBeInTheDocument()
  expect(screen.getByText(/3\. Reconciliation/)).toBeInTheDocument()
  expect(screen.getByText(/4\. Metadata/)).toBeInTheDocument()
  expect(screen.getByText(/5\. Review & Commit/)).toBeInTheDocument()
})

it("shows step 3 in skipped state when needsReconcile is false", () => {
  mockState({ step: 1, sessionId: null, needsReconcile: false })
  render(<WizardShell />)
  const step3 = screen.getByText(/3\. Reconciliation/)
  // The skipped styling adds line-through + opacity-30; we assert the visible
  // indicator that user sees: line-through class presence via accessible
  // content. The structural assertion is on the className token applied.
  expect(step3.className).toMatch(/line-through/)
})

it("current step highlight matches the step prop", () => {
  mockState({ step: 2, sessionId: 42, needsReconcile: true })
  render(<WizardShell />)
  const currentStep = screen.getByText(/2\. Field Detection/)
  // Current step uses border-primary + text-foreground
  expect(currentStep.className).toMatch(/border-primary/)
  expect(currentStep.className).toMatch(/text-foreground/)
})
