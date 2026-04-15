import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import type { QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"
import { FieldTreePanel } from "./FieldTreePanel"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn() },
}))

const mockGet = vi.mocked(api.GET)

const MOCK_TREE = {
  groups: [
    {
      id: 1,
      name: "Brand Perception",
      slug: "brand-perception",
      sort_order: 0,
      fields: [
        {
          id: 1,
          field_key: "brand_awareness",
          display_name: "Brand Awareness",
          field_type: "categorical",
          is_filterable: true,
          sort_order: 0,
        },
        {
          id: 2,
          field_key: "brand_rating",
          display_name: "Brand Rating",
          field_type: "ordinal",
          is_filterable: true,
          sort_order: 1,
        },
      ],
      children: [],
    },
    {
      id: 2,
      name: "Demographics",
      slug: "demographics",
      sort_order: 1,
      fields: [
        {
          id: 3,
          field_key: "gender",
          display_name: "Gender",
          field_type: "categorical",
          is_filterable: true,
          sort_order: 0,
        },
        {
          id: 4,
          field_key: "age_group",
          display_name: "Age Group",
          field_type: "categorical",
          is_filterable: true,
          sort_order: 1,
        },
      ],
      children: [],
    },
  ],
  ungrouped_fields: [],
}

function makeQuery(overrides: Partial<QueryConfig> = {}): QueryConfig {
  return { ...DEFAULT_QUERY, ...overrides }
}

function renderPanel(query: QueryConfig = makeQuery({ dataset_id: 1 }), onQueryChange = vi.fn()) {
  render(<FieldTreePanel onCollapse={vi.fn()} query={query} onQueryChange={onQueryChange} />)
  return { onQueryChange }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ data: MOCK_TREE } as never)
})

describe("FieldTreePanel", () => {
  it("shows illustrated empty state when no dataset is selected", () => {
    renderPanel(makeQuery({ dataset_id: null }))
    expect(screen.getByText("No dataset selected")).toBeInTheDocument()
    expect(
      screen.getByText("Choose a dataset in the Query Builder to browse fields"),
    ).toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it("shows loading skeleton while tree is fetching", () => {
    mockGet.mockReturnValue(new Promise(() => {}) as never)
    renderPanel()
    const skeletons = document.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("fetches and renders the field tree when dataset_id is set", async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByText("Brand Awareness")).toBeInTheDocument())
    expect(screen.getByText("Brand Rating")).toBeInTheDocument()
    expect(screen.getByText("Gender")).toBeInTheDocument()
    expect(screen.getByText("Age Group")).toBeInTheDocument()
  })

  it("renders group headers", async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByText("Brand Perception")).toBeInTheDocument())
    expect(screen.getByText("Demographics")).toBeInTheDocument()
  })

  it("clicking +R adds field to rows via onQueryChange", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel()
    await waitFor(() => expect(screen.getByText("Brand Awareness")).toBeInTheDocument())

    const fieldContainer = screen.getByTestId("field-row-brand_awareness")
    await user.hover(fieldContainer)
    await user.click(within(fieldContainer).getByRole("button", { name: "+R" }))

    expect(onQueryChange).toHaveBeenCalledOnce()
    const updater = onQueryChange.mock.calls[0][0] as (prev: QueryConfig) => QueryConfig
    const result = updater(makeQuery({ dataset_id: 1 }))
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].field_key).toBe("brand_awareness")
    expect(result.rows[0].display_name).toBe("Brand Awareness")
  })

  it("clicking +C adds field to columns in crosstab mode", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(makeQuery({ dataset_id: 1, mode: "crosstab" }))
    await waitFor(() => expect(screen.getByText("Gender")).toBeInTheDocument())

    const fieldContainer = screen.getByTestId("field-row-gender")
    await user.hover(fieldContainer)
    await user.click(within(fieldContainer).getByRole("button", { name: "+C" }))

    expect(onQueryChange).toHaveBeenCalledOnce()
    const updater = onQueryChange.mock.calls[0][0] as (prev: QueryConfig) => QueryConfig
    const result = updater(makeQuery({ dataset_id: 1 }))
    expect(result.columns).toHaveLength(1)
    expect(result.columns[0].field_key).toBe("gender")
    expect(result.columns[0].display_name).toBe("Gender")
  })

  it("+C button is not rendered in trend mode", async () => {
    renderPanel(makeQuery({ dataset_id: 1, mode: "trend" }))
    await waitFor(() => expect(screen.getByText("Brand Awareness")).toBeInTheDocument())
    // Hover to make buttons visible
    await userEvent.hover(screen.getByText("Brand Awareness"))
    expect(screen.queryByRole("button", { name: "+C" })).not.toBeInTheDocument()
  })

  it("does not add a field to rows if already present", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(
      makeQuery({
        dataset_id: 1,
        rows: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
      }),
    )
    await waitFor(() => expect(screen.getByText("Brand Awareness")).toBeInTheDocument())

    const fieldContainer = screen.getByTestId("field-row-brand_awareness")
    await user.hover(fieldContainer)
    await user.click(within(fieldContainer).getByRole("button", { name: "+R" }))

    // The updater should return the same state (no duplicate)
    expect(onQueryChange).toHaveBeenCalledOnce()
    const updater = onQueryChange.mock.calls[0][0] as (prev: QueryConfig) => QueryConfig
    const prev = makeQuery({
      dataset_id: 1,
      rows: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
    })
    const result = updater(prev)
    expect(result.rows).toHaveLength(1) // no duplicate added
  })

  it("search input filters visible fields", async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getByText("Brand Awareness")).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText("Search fields…"), "age")

    await waitFor(() => expect(screen.getByText("Age Group")).toBeInTheDocument())
    expect(screen.queryByText("Brand Awareness")).not.toBeInTheDocument()
    expect(screen.queryByText("Gender")).not.toBeInTheDocument()
  })

  it("enriches missing display_names on URL-restored chips when tree loads", async () => {
    // Simulate URL-restored state: field_key set, display_name missing
    const { onQueryChange } = renderPanel(
      makeQuery({
        dataset_id: 1,
        rows: [{ field_key: "brand_awareness" }], // no display_name
      }),
    )

    await waitFor(() => expect(mockGet).toHaveBeenCalledOnce())

    // onQueryChange should have been called to enrich the display_name
    await waitFor(() => expect(onQueryChange).toHaveBeenCalled())
    const updater = onQueryChange.mock.calls.find(([arg]) => typeof arg === "function")?.[0] as
      | ((prev: QueryConfig) => QueryConfig)
      | undefined

    expect(updater).toBeDefined()
    const prev = makeQuery({
      dataset_id: 1,
      rows: [{ field_key: "brand_awareness" }],
    })
    const enriched = updater?.(prev)
    expect(enriched?.rows[0].display_name).toBe("Brand Awareness")
  })
})
