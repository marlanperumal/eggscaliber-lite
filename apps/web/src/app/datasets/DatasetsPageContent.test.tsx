import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import { DatasetsPageContent } from "./DatasetsPageContent"

vi.mock("@/lib/api", () => ({
  api: {
    GET: vi.fn(),
    DELETE: vi.fn(),
    POST: vi.fn(),
    PATCH: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/datasets",
}))

const mockGet = vi.mocked(api.GET)
const mockDelete = vi.mocked(api.DELETE)

const PACKAGES = [{ id: 1, name: "Research" }]

const DATASETS = [
  {
    id: 1,
    name: "Wave 1",
    collection_id: 1,
    collection_name: "Brand Tracker",
    package_name: "Research",
    response_count: 512,
    field_count: 34,
    collected_at: null,
    created_at: "2025-01-15T00:00:00Z",
    status: "committed",
  },
  {
    id: 2,
    name: "Wave 2",
    collection_id: 1,
    collection_name: "Brand Tracker",
    package_name: "Research",
    response_count: 623,
    field_count: 36,
    collected_at: null,
    created_at: "2025-07-10T00:00:00Z",
    status: "committed",
  },
]

const DRAFTS = [
  {
    id: 5,
    status: "editing",
    dataset_name: "Wave 3 (draft)",
    collection_name: "Brand Tracker",
    package_name: "Research",
    created_at: "2025-10-01T00:00:00Z",
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

it("renders initial datasets from props without a loading state", () => {
  render(
    <DatasetsPageContent
      initialPackages={PACKAGES}
      initialDrafts={[]}
      initialDatasets={DATASETS}
    />,
  )
  expect(screen.getByText("Wave 1")).toBeInTheDocument()
  expect(screen.getByText("Wave 2")).toBeInTheDocument()
  expect(mockGet).not.toHaveBeenCalled()
})

it("shows empty state when no datasets provided", () => {
  render(<DatasetsPageContent initialPackages={PACKAGES} initialDrafts={[]} initialDatasets={[]} />)
  expect(screen.getByText("No datasets yet.")).toBeInTheDocument()
  expect(screen.queryByTestId("datasets-table")).not.toBeInTheDocument()
})

it("renders draft rows when initialDrafts is non-empty", () => {
  render(
    <DatasetsPageContent
      initialPackages={PACKAGES}
      initialDrafts={DRAFTS}
      initialDatasets={DATASETS}
    />,
  )
  expect(screen.getByText("In progress")).toBeInTheDocument()
  expect(screen.getByTestId("draft-session-row")).toBeInTheDocument()
  expect(screen.getByText("Wave 3 (draft)")).toBeInTheDocument()
})

it("filters datasets by search text", async () => {
  const user = userEvent.setup()
  render(
    <DatasetsPageContent
      initialPackages={PACKAGES}
      initialDrafts={[]}
      initialDatasets={DATASETS}
    />,
  )
  await user.type(screen.getByRole("searchbox"), "Wave 1")
  expect(screen.getByText("Wave 1")).toBeInTheDocument()
  expect(screen.queryByText("Wave 2")).not.toBeInTheDocument()
})

it("shows delete confirmation dialog and removes dataset on confirm", async () => {
  const user = userEvent.setup()
  mockDelete.mockResolvedValue({ data: undefined, error: undefined } as never)

  render(
    <DatasetsPageContent
      initialPackages={PACKAGES}
      initialDrafts={[]}
      initialDatasets={DATASETS}
    />,
  )

  const rows = screen.getAllByTestId("dataset-row")
  await user.click(within(rows[0]).getByRole("button", { name: /delete/i }))

  const confirmText = screen.getByText("Delete this dataset? This cannot be undone.")
  expect(confirmText).toBeInTheDocument()
  const dialog = confirmText.closest("div") as HTMLElement

  await user.click(within(dialog).getByRole("button", { name: /^delete$/i }))

  await waitFor(() => expect(mockDelete).toHaveBeenCalledOnce())
  expect(screen.queryByText("Wave 1")).not.toBeInTheDocument()
  expect(screen.getByText("Wave 2")).toBeInTheDocument()
})

it("cancels delete dialog without removing dataset", async () => {
  const user = userEvent.setup()
  render(
    <DatasetsPageContent
      initialPackages={PACKAGES}
      initialDrafts={[]}
      initialDatasets={DATASETS}
    />,
  )

  const rows = screen.getAllByTestId("dataset-row")
  await user.click(within(rows[0]).getByRole("button", { name: /delete/i }))
  await user.click(screen.getByRole("button", { name: /cancel/i }))

  expect(screen.queryByText("Delete this dataset? This cannot be undone.")).not.toBeInTheDocument()
  expect(screen.getByText("Wave 1")).toBeInTheDocument()
  expect(mockDelete).not.toHaveBeenCalled()
})
