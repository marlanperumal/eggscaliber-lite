import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { isApiError, useApiError } from "./useApiError"

describe("isApiError", () => {
  it("returns true for a well-formed ApiError", () => {
    expect(
      isApiError({ status: 404, code: "dataset_not_found", detail: "Dataset not found" }),
    ).toBe(true)
  })

  it("returns false for null", () => {
    expect(isApiError(null)).toBe(false)
  })

  it("returns false when code is missing", () => {
    expect(isApiError({ status: 404, detail: "something" })).toBe(false)
  })

  it("returns false when detail is missing", () => {
    expect(isApiError({ status: 404, code: "dataset_not_found" })).toBe(false)
  })

  it("returns false when status is not a number", () => {
    expect(isApiError({ status: "404", code: "dataset_not_found", detail: "..." })).toBe(false)
  })

  it("returns false for plain strings", () => {
    expect(isApiError("Network Error")).toBe(false)
  })
})

describe("useApiError", () => {
  it("returns isApiError=false and all nulls for non-error input", () => {
    const { result } = renderHook(() => useApiError(null))
    expect(result.current.isApiError).toBe(false)
    expect(result.current.code).toBeNull()
    expect(result.current.detail).toBeNull()
    expect(result.current.isNotFound).toBe(false)
    expect(result.current.isRetryable).toBe(false)
  })

  it("identifies a 404 not-found error", () => {
    const { result } = renderHook(() =>
      useApiError({ status: 404, code: "dataset_not_found", detail: "Dataset not found" }),
    )
    expect(result.current.isApiError).toBe(true)
    expect(result.current.code).toBe("dataset_not_found")
    expect(result.current.detail).toBe("Dataset not found")
    expect(result.current.isNotFound).toBe(true)
    expect(result.current.isRetryable).toBe(false)
  })

  it("identifies all not-found codes", () => {
    const notFoundCodes = [
      "package_not_found",
      "collection_not_found",
      "dataset_not_found",
      "upload_session_not_found",
      "field_not_found",
      "field_group_not_found",
      "level_not_found",
      "reconciliation_row_not_found",
    ]
    for (const code of notFoundCodes) {
      const { result } = renderHook(() => useApiError({ status: 404, code, detail: "" }))
      expect(result.current.isNotFound).toBe(true)
    }
  })

  it("identifies retryable errors", () => {
    for (const status of [408, 429, 502, 503, 504]) {
      const { result } = renderHook(() =>
        useApiError({ status, code: "ai_service_error", detail: "..." }),
      )
      expect(result.current.isRetryable).toBe(true)
    }
  })

  it("returns isRetryable=false for 404", () => {
    const { result } = renderHook(() =>
      useApiError({ status: 404, code: "dataset_not_found", detail: "..." }),
    )
    expect(result.current.isRetryable).toBe(false)
  })

  it("returns isApiError=false for unknown error shape (missing code)", () => {
    const { result } = renderHook(() => useApiError({ message: "Network error" }))
    expect(result.current.isApiError).toBe(false)
  })
})
