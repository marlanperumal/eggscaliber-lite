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

it("marks step 3 as skipped when needsReconcile is false", () => {
  mockState({ step: 1, sessionId: null, needsReconcile: false })
  render(<WizardShell />)
  expect(screen.getByText(/3\. Reconciliation/)).toHaveAttribute("data-skipped", "true")
})

it("does not mark step 3 as skipped when needsReconcile is true", () => {
  mockState({ step: 1, sessionId: null, needsReconcile: true })
  render(<WizardShell />)
  expect(screen.getByText(/3\. Reconciliation/)).not.toHaveAttribute("data-skipped")
})

it("marks the current step with aria-current", () => {
  mockState({ step: 2, sessionId: 42, needsReconcile: true })
  render(<WizardShell />)
  expect(screen.getByText(/2\. Field Detection/)).toHaveAttribute("aria-current", "step")
  expect(screen.getByText(/1\. File & Hierarchy/)).not.toHaveAttribute("aria-current")
})
