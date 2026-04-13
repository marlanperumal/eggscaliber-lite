import { act, renderHook } from "@testing-library/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_QUERY } from "./analytics-types"
import { useAnalyticsState } from "./useAnalyticsState"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}))

const mockReplace = vi.fn()

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({ replace: mockReplace } as ReturnType<typeof useRouter>)
  vi.mocked(usePathname).mockReturnValue("/analytics")
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams() as ReturnType<typeof useSearchParams>,
  )
  mockReplace.mockClear()
})

describe("useAnalyticsState", () => {
  it("returns DEFAULT_QUERY when no q param is present", () => {
    const { result } = renderHook(() => useAnalyticsState())
    expect(result.current.query).toEqual(DEFAULT_QUERY)
  })

  it("parses valid JSON from q param and merges with DEFAULT_QUERY", () => {
    const partial = { mode: "trend", dataset_id: 42 }
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        q: encodeURIComponent(JSON.stringify(partial)),
      }) as ReturnType<typeof useSearchParams>,
    )
    const { result } = renderHook(() => useAnalyticsState())
    expect(result.current.query.mode).toBe("trend")
    expect(result.current.query.dataset_id).toBe(42)
    expect(result.current.query.rows).toEqual(DEFAULT_QUERY.rows)
  })

  it("falls back to DEFAULT_QUERY when q param contains malformed JSON", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        q: encodeURIComponent("not-json{{{"),
      }) as ReturnType<typeof useSearchParams>,
    )
    const { result } = renderHook(() => useAnalyticsState())
    expect(result.current.query).toEqual(DEFAULT_QUERY)
  })

  it("setQuery encodes the new state into the URL", () => {
    const { result } = renderHook(() => useAnalyticsState())
    act(() => {
      result.current.setQuery({ ...DEFAULT_QUERY, dataset_id: 7 })
    })
    expect(mockReplace).toHaveBeenCalledOnce()
    const [url] = mockReplace.mock.calls[0] as [string]
    const params = new URLSearchParams(url.split("?")[1])
    const parsed = JSON.parse(decodeURIComponent(params.get("q")!))
    expect(parsed.dataset_id).toBe(7)
  })

  it("setQuery accepts a function updater and receives the current query", () => {
    const partial = { mode: "trend" }
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        q: encodeURIComponent(JSON.stringify(partial)),
      }) as ReturnType<typeof useSearchParams>,
    )
    const { result } = renderHook(() => useAnalyticsState())
    act(() => {
      result.current.setQuery((prev) => ({ ...prev, dataset_id: 5 }))
    })
    const [url] = mockReplace.mock.calls[0] as [string]
    const params = new URLSearchParams(url.split("?")[1])
    const parsed = JSON.parse(decodeURIComponent(params.get("q")!))
    expect(parsed.mode).toBe("trend")
    expect(parsed.dataset_id).toBe(5)
  })
})
