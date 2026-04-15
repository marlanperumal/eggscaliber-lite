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
    onLoadingChange?: ReturnType<typeof vi.fn>
  } = {},
) {
  const onQueryChange = overrides.onQueryChange ?? vi.fn()
  const onResult = overrides.onResult ?? vi.fn()
  const onLoadingChange = overrides.onLoadingChange ?? vi.fn()
  render(
    <QueryBuilderPanel
      onCollapse={vi.fn()}
      query={query}
      onQueryChange={
        onQueryChange as unknown as (
          q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig),
        ) => void
      }
      onResult={onResult as unknown as (r: AnalyticsResult, q: QueryConfig) => void}
      isLoading={false}
      onLoadingChange={onLoadingChange as (loading: boolean) => void}
    />,
  )
  return { onQueryChange, onResult, onLoadingChange }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ data: SCOPE_RESPONSE } as never)
})

describe("QueryBuilderPanel", () => {
  it("renders mode cards and defaults to cross-tab", () => {
    renderPanel()
    expect(screen.getByRole("button", { name: /cross-tab/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /trending/i })).toBeInTheDocument()
    expect(screen.getByText("Dataset")).toBeInTheDocument()
  })

  it("trend mode shows Collection scope picker instead of Dataset", () => {
    renderPanel(makeQuery({ mode: "trend" }))
    expect(screen.getByText("Collection")).toBeInTheDocument()
    expect(screen.queryByText("Dataset")).not.toBeInTheDocument()
  })

  it("shows error when Run clicked without a dataset in crosstab mode", async () => {
    const user = userEvent.setup()
    renderPanel(makeQuery({ dataset_id: null }))
    await user.click(screen.getByRole("button", { name: /run query/i }))
    expect(screen.getByText("Select a dataset first")).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it("shows error when Run clicked without a collection in trend mode", async () => {
    const user = userEvent.setup()
    renderPanel(makeQuery({ mode: "trend", collection_id: null }))
    await user.click(screen.getByRole("button", { name: /run query/i }))
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

    await user.click(screen.getByRole("button", { name: /run query/i }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledOnce())
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/analytics/crosstab",
      expect.objectContaining({
        body: expect.objectContaining({ dataset_id: 1 }),
      }),
    )
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(CROSSTAB_RESULT, expect.anything()))
  })

  it("calls onLoadingChange(true) when Run is clicked", async () => {
    const user = userEvent.setup()
    mockPost.mockReturnValueOnce(new Promise(() => {}) as never)
    const { onLoadingChange } = renderPanel(makeQuery({ dataset_id: 1 }))

    await user.click(screen.getByRole("button", { name: /run query/i }))
    expect(onLoadingChange).toHaveBeenCalledWith(true)
  })

  it("shows error message when API call fails", async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ error: { detail: "Internal Server Error" } } as never)
    renderPanel(makeQuery({ dataset_id: 1 }))

    await user.click(screen.getByRole("button", { name: /run query/i }))

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

    const chip = screen.getByTestId("field-chip-gender")
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
    const chip = screen.getByTestId("field-chip-age_group")
    await user.click(within(chip).getByRole("button"))
    expect(onQueryChange).toHaveBeenCalled()
    const updatedQuery = onQueryChange.mock.calls[0][0] as QueryConfig
    expect(updatedQuery.filters).toHaveLength(0)
  })

  it("measure matrix: clicking a cell sets type and display together", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(makeQuery({ dataset_id: 1 }))

    await user.click(screen.getByRole("button", { name: "Weighted, N" }))
    expect(onQueryChange).toHaveBeenCalled()
    const updatedQuery = onQueryChange.mock.calls[0][0] as QueryConfig
    expect(updatedQuery.measure.type).toBe("weighted")
    expect(updatedQuery.measure.display).toBe("n")
  })

  it("measure matrix: clicking a display row sets the correct display", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(makeQuery({ dataset_id: 1 }))

    await user.click(screen.getByRole("button", { name: "Count, % Col" }))
    expect(onQueryChange).toHaveBeenCalled()
    const updatedQuery = onQueryChange.mock.calls[0][0] as QueryConfig
    expect(updatedQuery.measure.display).toBe("pct_col")
  })

  it("shows stacked/nested toggle inside zone when 2+ fields are present", () => {
    renderPanel(
      makeQuery({
        rows: [
          { field_key: "gender", display_name: "Gender" },
          { field_key: "age_group", display_name: "Age Group" },
        ],
      }),
    )
    expect(screen.getByRole("button", { name: "Stacked ↕" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Nested →" })).toBeInTheDocument()
  })

  it("does not show stacked/nested toggle with fewer than 2 fields", () => {
    renderPanel(
      makeQuery({
        rows: [{ field_key: "gender", display_name: "Gender" }],
      }),
    )
    expect(screen.queryByRole("button", { name: "Stacked ↕" })).not.toBeInTheDocument()
  })
})
