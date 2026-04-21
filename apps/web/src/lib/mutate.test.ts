import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner")

import { toast } from "sonner"
import { mutate } from "./mutate"

const mockToastError = vi.mocked(toast.error)

describe("mutate", () => {
  beforeEach(() => {
    mockToastError.mockClear()
  })

  it("returns data and no error on success", async () => {
    const result = await mutate(() =>
      Promise.resolve({ data: { id: 1 }, response: new Response() }),
    )
    expect(result.data).toEqual({ id: 1 })
    expect(result.error).toBeUndefined()
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it("shows default toast and returns error when call fails", async () => {
    const result = await mutate(() =>
      Promise.resolve({ error: { detail: "Not found" }, response: new Response() }),
    )
    expect(result.error).toEqual({ detail: "Not found" })
    expect(result.data).toBeUndefined()
    expect(mockToastError).toHaveBeenCalledWith("Something went wrong. Please try again.")
  })

  it("shows custom error message when provided", async () => {
    await mutate(
      () => Promise.resolve({ error: { detail: "Server error" }, response: new Response() }),
      { errorMessage: "Failed to save." },
    )
    expect(mockToastError).toHaveBeenCalledWith("Failed to save.")
  })

  it("does not call toast when error is undefined", async () => {
    await mutate(() => Promise.resolve({ data: { ok: true }, response: new Response() }))
    expect(mockToastError).not.toHaveBeenCalled()
  })
})
