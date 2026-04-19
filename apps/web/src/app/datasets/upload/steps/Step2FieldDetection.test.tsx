import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import type { WizardState } from "../wizard-types"
import { Step2FieldDetection } from "./Step2FieldDetection"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), PATCH: vi.fn() },
}))

const mockGet = vi.mocked(api.GET)
const mockPatch = vi.mocked(api.PATCH)

const MOCK_FIELD = {
  id: 1,
  field_key: "q_gender",
  detected_type: "categorical",
  confidence: "high",
  override_type: null,
  value_sample: ["Male", "Female"],
  sort_order: 0,
  display_name: "Gender",
}

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return { step: 2, sessionId: 1, needsReconcile: true, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
})

it("shows loading text while fetching fields", () => {
  mockGet.mockReturnValue(new Promise(() => {}) as never)
  render(<Step2FieldDetection state={makeState()} setStep={vi.fn()} />)
  expect(screen.getByText(/loading fields/i)).toBeInTheDocument()
})

it("renders fields table after loading", async () => {
  mockGet.mockResolvedValueOnce({ data: { fields: [MOCK_FIELD] } } as never)
  render(<Step2FieldDetection state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => expect(screen.getByTestId("field-detection-table")).toBeInTheDocument())
  expect(screen.getByText("q_gender")).toBeInTheDocument()
  expect(screen.getAllByText("categorical").length).toBeGreaterThan(0)
})

it("calls PATCH and shows updated override type when override is selected", async () => {
  mockGet.mockResolvedValueOnce({ data: { fields: [MOCK_FIELD] } } as never)
  mockPatch.mockResolvedValueOnce({ data: { ...MOCK_FIELD, override_type: "numeric" } } as never)
  render(<Step2FieldDetection state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => screen.getByTestId("field-detection-table"))
  const overrideSelect = screen.getByLabelText("Override type for q_gender")
  fireEvent.change(overrideSelect, { target: { value: "numeric" } })
  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith(
      "/api/v1/uploads/{session_id}/fields/{field_id}",
      expect.objectContaining({ body: { override_type: "numeric" } }),
    ),
  )
})

it("shows Reset button after override is set and calls PATCH with null on click", async () => {
  const overriddenField = { ...MOCK_FIELD, override_type: "numeric" }
  mockGet.mockResolvedValueOnce({ data: { fields: [overriddenField] } } as never)
  mockPatch.mockResolvedValueOnce({ data: { ...MOCK_FIELD, override_type: null } } as never)
  render(<Step2FieldDetection state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => screen.getByRole("button", { name: /reset q_gender/i }))
  await userEvent.click(screen.getByRole("button", { name: /reset q_gender/i }))
  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith(
      "/api/v1/uploads/{session_id}/fields/{field_id}",
      expect.objectContaining({ body: { override_type: null } }),
    ),
  )
})

it("routes to step 3 when needsReconcile is true", async () => {
  const setStep = vi.fn()
  mockGet.mockResolvedValueOnce({ data: { fields: [] } } as never)
  render(<Step2FieldDetection state={makeState({ needsReconcile: true })} setStep={setStep} />)
  await waitFor(() => screen.getByRole("button", { name: /next/i }))
  await userEvent.click(screen.getByRole("button", { name: /next/i }))
  expect(setStep).toHaveBeenCalledWith(3)
})

it("routes to step 4 when needsReconcile is false", async () => {
  const setStep = vi.fn()
  mockGet.mockResolvedValueOnce({ data: { fields: [] } } as never)
  render(<Step2FieldDetection state={makeState({ needsReconcile: false })} setStep={setStep} />)
  await waitFor(() => screen.getByRole("button", { name: /next/i }))
  await userEvent.click(screen.getByRole("button", { name: /next/i }))
  expect(setStep).toHaveBeenCalledWith(4)
})
