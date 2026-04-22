import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import { mutate } from "@/lib/mutate"
import type { WizardState } from "../wizard-types"
import { ReviewCommit } from "./ReviewCommit"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
}))

vi.mock("@/lib/mutate", () => ({
  mutate: vi.fn((fn, _opts) =>
    fn().then((r: { data: unknown; error: unknown }) => ({ data: r.data, error: r.error })),
  ),
}))

const mockPush = vi.fn()
// Not URL state — mocking useRouter for post-commit navigation, not nuqs URL params
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockGet = vi.mocked(api.GET)
const mockPost = vi.mocked(api.POST)

const MOCK_SESSION = {
  dataset_name: "Wave 3",
  row_count: 100,
  collection_id: 1,
  collection_name: "Brand Tracker",
  package_name: "Demo Package",
  collected_at: "2024-01-01",
  file_name: "survey.csv",
  fields: [
    { detected_type: "categorical", override_type: null },
    { detected_type: "numeric", override_type: null },
  ],
}
const MOCK_TREE = {
  groups: [{ id: 1, name: "Demographics", parent_id: null, field_count: 2 }],
  fields: [],
  unassigned_fields: [],
}

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return { step: 5, sessionId: 1, needsReconcile: false, ...overrides }
}

function setupGetMock() {
  mockGet.mockImplementation(async (path) => {
    const p = path as string
    if (p.includes("field-tree")) return { data: MOCK_TREE } as never
    if (p.includes("suggested-reference"))
      return { data: { dataset_id: null, dataset_name: "Wave 2" } } as never
    if (p.includes("reconcile/counts")) {
      return {
        data: {
          exact: 5,
          confirmed: 2,
          new_only: 1,
          old_only: 0,
          blocking_pending: 0,
          status_counts: {},
        },
      } as never
    }
    if (p.includes("reconcile")) return { data: { items: [], next_cursor: null } } as never
    return { data: MOCK_SESSION } as never
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPush.mockClear()
})

it("shows loading text while summary is being fetched", () => {
  mockGet.mockReturnValue(new Promise(() => {}) as never)
  render(<ReviewCommit state={makeState()} setStep={vi.fn()} />)
  expect(screen.getByText(/loading summary/i)).toBeInTheDocument()
})

it("displays dataset name after summary loads", async () => {
  setupGetMock()
  render(<ReviewCommit state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => expect(screen.getAllByText("Wave 3").length).toBeGreaterThan(0))
  expect(screen.getByText("Brand Tracker")).toBeInTheDocument()
})

it("calls commit API when Commit dataset button is clicked", async () => {
  setupGetMock()
  mockPost.mockResolvedValueOnce({ error: null } as never)
  render(<ReviewCommit state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => screen.getByRole("button", { name: /commit dataset/i }))
  await userEvent.click(screen.getByRole("button", { name: /commit dataset/i }))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/uploads/{session_id}/commit",
      expect.objectContaining({ params: { path: { session_id: 1 } } }),
    ),
  )
})

it("navigates to /datasets after successful commit", async () => {
  setupGetMock()
  mockPost.mockResolvedValueOnce({ error: null } as never)
  render(<ReviewCommit state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => screen.getByRole("button", { name: /commit dataset/i }))
  await userEvent.click(screen.getByRole("button", { name: /commit dataset/i }))
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/datasets"))
})

it("shows error message when commit API returns an error", async () => {
  setupGetMock()
  mockPost.mockResolvedValueOnce({ error: { detail: "Commit failed" } } as never)
  render(<ReviewCommit state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => screen.getByRole("button", { name: /commit dataset/i }))
  await userEvent.click(screen.getByRole("button", { name: /commit dataset/i }))
  await waitFor(() =>
    expect(mutate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ errorMessage: "Commit failed. Please try again." }),
    ),
  )
  expect(mockPush).not.toHaveBeenCalled()
})

it("navigates to step 1 when Dataset details Edit is clicked", async () => {
  setupGetMock()
  const setStep = vi.fn()
  render(<ReviewCommit state={makeState()} setStep={setStep} />)
  await waitFor(() => expect(screen.getAllByText("Wave 3").length).toBeGreaterThan(0))
  await userEvent.click(screen.getAllByRole("button", { name: /← edit/i })[0])
  expect(setStep).toHaveBeenCalledWith(1)
})
