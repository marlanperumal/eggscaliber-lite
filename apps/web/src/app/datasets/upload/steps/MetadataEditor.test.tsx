import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import type { WizardState } from "../wizard-types"
import { MetadataEditor } from "./MetadataEditor"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}))

const mockGet = vi.mocked(api.GET)

const EMPTY_TREE = { fields: [], unassigned_fields: [], groups: [] }

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return { step: 4, sessionId: 1, needsReconcile: true, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
})

it("shows loading text while field tree is fetching", () => {
  mockGet.mockReturnValue(new Promise(() => {}) as never)
  render(<MetadataEditor state={makeState()} setStep={vi.fn()} />)
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
})

it("marks List tab as active when List tab is clicked", async () => {
  const user = userEvent.setup()
  mockGet.mockResolvedValue({ data: EMPTY_TREE } as never)
  render(<MetadataEditor state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => expect(screen.getByRole("button", { name: /list/i })).toBeInTheDocument())
  await user.click(screen.getByRole("button", { name: /list/i }))
  expect(screen.getByRole("button", { name: /list/i })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: /tree/i })).toHaveAttribute("aria-pressed", "false")
})

it("Back navigates to step 3 when needsReconcile is true", async () => {
  const setStep = vi.fn()
  mockGet.mockResolvedValue({ data: EMPTY_TREE } as never)
  render(<MetadataEditor state={makeState({ needsReconcile: true })} setStep={setStep} />)
  await waitFor(() => expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument())
  await userEvent.click(screen.getByRole("button", { name: /back/i }))
  expect(setStep).toHaveBeenCalledWith(3)
})

it("Back navigates to step 2 when needsReconcile is false", async () => {
  const setStep = vi.fn()
  mockGet.mockResolvedValue({ data: EMPTY_TREE } as never)
  render(<MetadataEditor state={makeState({ needsReconcile: false })} setStep={setStep} />)
  await waitFor(() => expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument())
  await userEvent.click(screen.getByRole("button", { name: /back/i }))
  expect(setStep).toHaveBeenCalledWith(2)
})
