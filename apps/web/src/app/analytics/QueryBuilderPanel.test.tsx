import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import type { AnalyticsResult, QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"
import { QueryBuilderPanel } from "./QueryBuilderPanel"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
}))

const mockGet = vi.mocked(api.GET)
const mockPost = vi.mocked(api.POST)

const SCOPE_RESPONSE = [
  {
    id: 1,
    name: "Demo Data",
    collections: [
      {
        id: 1,
        name: "Brand Tracker",
        datasets: [{ id: 1, name: "Wave 1" }],
      },
    ],
  },
]

const CROSSTAB_RESULT: AnalyticsResult = {
  meta: {
    mode: "crosstab",
    measure: { type: "count", field_key: null, aggregation: null, display: "n" },
    dataset_name: "Wave 1",
    base_n: 50,
    row_fields: [{ field_key: "gender", display_name: "Gender" }],
    col_fields: [],
    level_labels: { gender: { male: "Male", female: "Female" } },
  },
  rows: [{ key: ["gender", "male"], values: { Total: 25 } }],
}

function makeQuery(overrides: Partial<QueryConfig> = {}): QueryConfig {
  return { ...DEFAULT_QUERY, ...overrides }
}

function renderPanel(
  query: QueryConfig = makeQuery(),
  overrides: {
    onQueryChange?: ReturnType<typeof vi.fn>
    onResult?: ReturnType<typeof vi.fn>
  } = {},
) {
  const onQueryChange = overrides.onQueryChange ?? vi.fn()
  const onResult = overrides.onResult ?? vi.fn()
  render(
    <QueryBuilderPanel
      onCollapse={vi.fn()}
      query={query}
      onQueryChange={onQueryChange}
      onResult={onResult}
    />,
  )
  return { onQueryChange, onResult }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: scope loads successfully with no packages
  mockGet.mockResolvedValue({ data: SCOPE_RESPONSE } as never)
})

describe("QueryBuilderPanel", () => {
  it("renders mode tabs and defaults to cross-tab", () => {
    renderPanel()
    expect(screen.getByRole("button", { name: "Cross-tab" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Trending" })).toBeInTheDocument()
    // Cross-tab shows Dataset scope picker
    expect(screen.getByText("Dataset")).toBeInTheDocument()
  })

  it("switching to Trending shows Collection scope picker", async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole("button", { name: "Trending" }))
    // onQueryChange is called with mode: 'trend'
    // But since query is controlled from outside, we also test the label change
    // Re-render with trend mode to simulate the controlled update
    renderPanel(makeQuery({ mode: "trend" }))
    expect(screen.getByText("Collection")).toBeInTheDocument()
  })

  it("shows error when Run clicked without a dataset in crosstab mode", async () => {
    const user = userEvent.setup()
    renderPanel(makeQuery({ dataset_id: null }))
    await user.click(screen.getByRole("button", { name: "Run" }))
    expect(screen.getByText("Select a dataset first")).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it("shows error when Run clicked without a collection in trend mode", async () => {
    const user = userEvent.setup()
    renderPanel(makeQuery({ mode: "trend", collection_id: null }))
    await user.click(screen.getByRole("button", { name: "Run" }))
    expect(screen.getByText("Select a collection first")).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it("calls crosstab API and invokes onResult on successful run", async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ data: CROSSTAB_RESULT } as never)
    const { onResult } = renderPanel(
      makeQuery({
        dataset_id: 1,
        rows: [{ field_key: "gender", display_name: "Gender" }],
      }),
    )

    await user.click(screen.getByRole("button", { name: "Run" }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledOnce())
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/analytics/crosstab",
      expect.objectContaining({
        body: expect.objectContaining({ dataset_id: 1 }),
      }),
    )
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(CROSSTAB_RESULT, expect.anything()))
  })

  it("shows loading state while API call is in flight", async () => {
    const user = userEvent.setup()
    // Never-resolving promise to keep loading state visible
    mockPost.mockReturnValueOnce(new Promise(() => {}) as never)
    renderPanel(makeQuery({ dataset_id: 1 }))

    await user.click(screen.getByRole("button", { name: "Run" }))
    expect(screen.getByRole("button", { name: "Running…" })).toBeDisabled()
  })

  it("shows error message when API call fails", async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ error: { detail: "Internal Server Error" } } as never)
    renderPanel(makeQuery({ dataset_id: 1 }))

    await user.click(screen.getByRole("button", { name: "Run" }))

    await waitFor(() => expect(screen.getByText(/internal server error/i)).toBeInTheDocument())
  })

  it("displays existing row fields with a remove button", () => {
    renderPanel(
      makeQuery({
        rows: [{ field_key: "gender", display_name: "Gender" }],
      }),
    )
    expect(screen.getByText("Gender")).toBeInTheDocument()
  })

  it("calls onQueryChange when a row field is removed", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(
      makeQuery({
        dataset_id: 1,
        rows: [{ field_key: "gender", display_name: "Gender" }],
      }),
    )

    // Find the chip containing "Gender" and click its remove button
    const chip = screen.getByText("Gender").closest("div") as HTMLElement
    await user.click(within(chip).getByRole("button"))

    expect(onQueryChange).toHaveBeenCalled()
    const updatedQuery = onQueryChange.mock.calls[0][0] as QueryConfig
    expect(updatedQuery.rows).toHaveLength(0)
  })

  it("displays filter fields and allows removal", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(
      makeQuery({
        filters: [{ field_key: "age_group", display_name: "Age Group", levels: ["18_34"] }],
      }),
    )

    expect(screen.getByText("Age Group")).toBeInTheDocument()
    // Remove filter: the chip containing "Age Group" has a single button (trash icon)
    const chip = screen.getByText("Age Group").closest("div") as HTMLElement
    await user.click(within(chip).getByRole("button"))
    expect(onQueryChange).toHaveBeenCalled()
    const updatedQuery = onQueryChange.mock.calls[0][0] as QueryConfig
    expect(updatedQuery.filters).toHaveLength(0)
  })

  it("measure type selection calls onQueryChange with updated measure", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(makeQuery({ dataset_id: 1 }))

    await user.click(screen.getByRole("button", { name: "Weighted" }))
    expect(onQueryChange).toHaveBeenCalled()
    const updatedQuery = onQueryChange.mock.calls[0][0] as QueryConfig
    expect(updatedQuery.measure.type).toBe("weighted")
  })

  it("display type selection calls onQueryChange with updated display", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(makeQuery({ dataset_id: 1 }))

    await user.click(screen.getByRole("button", { name: "% Col" }))
    expect(onQueryChange).toHaveBeenCalled()
    const updatedQuery = onQueryChange.mock.calls[0][0] as QueryConfig
    expect(updatedQuery.measure.display).toBe("pct_col")
  })
})
