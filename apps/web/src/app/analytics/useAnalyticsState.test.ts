import { act, renderHook } from "@testing-library/react"
import { useQueryStates } from "nuqs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_QUERY } from "./analytics-types"
import { useAnalyticsState } from "./useAnalyticsState"

vi.mock("nuqs", async (importActual) => {
  const actual = await importActual<typeof import("nuqs")>()
  return { ...actual, useQueryStates: vi.fn() }
})

const mockSetP = vi.fn()

const defaultParams = {
  mode: "crosstab" as const,
  ds: null,
  col: null,
  rows: [],
  row_mode: "stacked" as const,
  cols: [],
  col_mode: "stacked" as const,
  bd: null,
  filters: [],
  mt: "count" as const,
  md: "n" as const,
  mf: null,
  ma: null,
}

beforeEach(() => {
  vi.mocked(useQueryStates).mockReturnValue([defaultParams, mockSetP])
  mockSetP.mockClear()
})

describe("useAnalyticsState", () => {
  it("returns DEFAULT_QUERY when all params are at defaults", () => {
    const { result } = renderHook(() => useAnalyticsState())
    expect(result.current.query).toEqual(DEFAULT_QUERY)
  })

  it("assembles QueryConfig correctly from URL params", () => {
    vi.mocked(useQueryStates).mockReturnValue([
      {
        ...defaultParams,
        mode: "trend" as const,
        ds: 42,
        rows: [{ field_key: "q_gender", display_name: "Gender" }, { field_key: "q_age" }],
      },
      mockSetP,
    ])
    const { result } = renderHook(() => useAnalyticsState())
    expect(result.current.query.mode).toBe("trend")
    expect(result.current.query.dataset_id).toBe(42)
    expect(result.current.query.rows).toEqual([
      { field_key: "q_gender", display_name: "Gender" },
      { field_key: "q_age" },
    ])
  })

  it("setQuery encodes QueryConfig into flat URL params", () => {
    const { result } = renderHook(() => useAnalyticsState())
    act(() => {
      result.current.setQuery({ ...DEFAULT_QUERY, dataset_id: 7, mode: "trend" })
    })
    expect(mockSetP).toHaveBeenCalledOnce()
    const call = vi.mocked(mockSetP).mock.calls[0][0]
    expect(call.ds).toBe(7)
    expect(call.mode).toBe("trend")
    expect(call.rows).toEqual([])
  })

  it("setQuery preserves display_names for FieldSelection arrays", () => {
    const { result } = renderHook(() => useAnalyticsState())
    act(() => {
      result.current.setQuery({
        ...DEFAULT_QUERY,
        rows: [
          { field_key: "q_education", display_name: "Education" },
          { field_key: "q_income", display_name: "Income" },
        ],
        columns: [{ field_key: "q_gender", display_name: "Gender" }],
      })
    })
    const call = vi.mocked(mockSetP).mock.calls[0][0]
    expect(call.rows).toEqual([
      { field_key: "q_education", display_name: "Education" },
      { field_key: "q_income", display_name: "Income" },
    ])
    expect(call.cols).toEqual([{ field_key: "q_gender", display_name: "Gender" }])
  })

  it("setQuery accepts a function updater that receives the current query", () => {
    vi.mocked(useQueryStates).mockReturnValue([
      { ...defaultParams, mode: "trend" as const },
      mockSetP,
    ])
    const { result } = renderHook(() => useAnalyticsState())
    act(() => {
      result.current.setQuery((prev) => ({ ...prev, dataset_id: 5 }))
    })
    const call = vi.mocked(mockSetP).mock.calls[0][0]
    expect(call.mode).toBe("trend")
    expect(call.ds).toBe(5)
  })

  it("setQuery maps breakdown and measure correctly", () => {
    const { result } = renderHook(() => useAnalyticsState())
    act(() => {
      result.current.setQuery({
        ...DEFAULT_QUERY,
        breakdown: { field_key: "q_region", display_name: "Region" },
        measure: { type: "weighted", field_key: null, aggregation: null, display: "pct_col" },
      })
    })
    const call = vi.mocked(mockSetP).mock.calls[0][0]
    expect(call.bd).toBe("q_region")
    expect(call.mt).toBe("weighted")
    expect(call.md).toBe("pct_col")
  })
})
