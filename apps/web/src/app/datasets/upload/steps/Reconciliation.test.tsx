import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import type { WizardState } from "../wizard-types"
import { Reconciliation } from "./Reconciliation"
import type { ReconRow } from "./ReconciliationRow"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}))

const mockGet = vi.mocked(api.GET)
const mockPost = vi.mocked(api.POST)

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return { step: 3, sessionId: 1, needsReconcile: true, ...overrides }
}

const EMPTY_COUNTS = {
  exact: 0,
  probable: 0,
  new_only: 0,
  old_only: 0,
  blocking_pending: 0,
  status_counts: {},
}

const MOCK_ROW: ReconRow = {
  id: 1,
  group: "probable",
  status: "pending",
  upload_field_id: 10,
  ref_field_id: 20,
  confidence: 0.9,
  note: null,
  field_key: "gende",
  ref_field_key: "gender",
  field_type: "categorical",
}

function mockGetForTriggered(counts = EMPTY_COUNTS, rows: ReconRow[] = []) {
  mockGet.mockImplementation(async (path) => {
    const p = path as string
    if (p.includes("suggested-reference"))
      return { data: { dataset_id: null, dataset_name: null } } as never
    if (p.includes("reconcile/counts")) return { data: counts } as never
    if (p.includes("field-tree"))
      return { data: { fields: [], unassigned_fields: [], groups: [] } } as never
    if (p.includes("reconcile")) return { data: { items: rows, next_cursor: null } } as never
    return { data: null } as never
  })
  mockPost.mockResolvedValue({ data: { total: rows.length } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

it("shows suggested reference dataset name fetched on mount", async () => {
  mockGet.mockImplementation(async (path) => {
    if ((path as string).includes("suggested-reference"))
      return { data: { dataset_id: 42, dataset_name: "Wave 2" } } as never
    return { data: null } as never
  })
  render(<Reconciliation state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => expect(screen.getByText("Wave 2")).toBeInTheDocument())
})

it("disables Run button when reference dataset ID is empty", async () => {
  mockGet.mockResolvedValue({ data: { dataset_id: null, dataset_name: null } } as never)
  render(<Reconciliation state={makeState()} setStep={vi.fn()} />)
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /run reconciliation/i })).toBeDisabled(),
  )
})

it("shows reconciliation tabs after running", async () => {
  const user = userEvent.setup()
  mockGetForTriggered()
  render(<Reconciliation state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => screen.getByRole("button", { name: /run reconciliation/i }))
  await user.type(screen.getByPlaceholderText("Reference dataset ID"), "10")
  await user.click(screen.getByRole("button", { name: /run reconciliation/i }))
  await waitFor(() => expect(screen.getByRole("button", { name: /exact/i })).toBeInTheDocument())
  expect(screen.getByRole("button", { name: /probable/i })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /new only/i })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /old only/i })).toBeInTheDocument()
})

it("shows bulk action toolbar when a row is selected", async () => {
  const user = userEvent.setup()
  mockGetForTriggered(EMPTY_COUNTS, [MOCK_ROW])
  render(<Reconciliation state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => screen.getByRole("button", { name: /run reconciliation/i }))
  await user.type(screen.getByPlaceholderText("Reference dataset ID"), "10")
  await user.click(screen.getByRole("button", { name: /run reconciliation/i }))
  await waitFor(() => expect(screen.getByTestId("recon-row")).toBeInTheDocument())
  await user.click(screen.getByRole("checkbox", { name: /select row 1/i }))
  expect(screen.getByText("1 selected")).toBeInTheDocument()
})

it("shows blocking warning and disables Next when blocking_pending > 0", async () => {
  const user = userEvent.setup()
  mockGetForTriggered({ ...EMPTY_COUNTS, blocking_pending: 2 })
  render(<Reconciliation state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => screen.getByRole("button", { name: /run reconciliation/i }))
  await user.type(screen.getByPlaceholderText("Reference dataset ID"), "10")
  await user.click(screen.getByRole("button", { name: /run reconciliation/i }))
  await waitFor(() => expect(screen.getByText(/still need a decision/i)).toBeInTheDocument())
  expect(screen.getByRole("button", { name: /next/i })).toBeDisabled()
})
