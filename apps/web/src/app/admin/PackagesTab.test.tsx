import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}))

import { api } from "@/lib/api"
import { PackagesTab } from "./PackagesTab"

const mockGet = vi.mocked(api.GET)
const mockPatch = vi.mocked(api.PATCH)

const mockPackages = [
  { id: 1, name: "Brand Tracker", slug: "brand-tracker", visibility: "private" },
  { id: 2, name: "Customer Survey", slug: "customer-survey", visibility: "public" },
]

describe("PackagesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/admin/packages") return Promise.resolve({ data: mockPackages } as never)
      if (url === "/api/v1/admin/packages/{package_id}/collections")
        return Promise.resolve({ data: [] } as never)
      if (url === "/api/v1/admin/collections") return Promise.resolve({ data: [] } as never)
      return Promise.resolve({ data: [] } as never)
    })
  })

  it("renders a search input and package rows after loading", async () => {
    render(<PackagesTab />)
    await waitFor(() => screen.getByTestId("package-row-1"))
    expect(screen.getByPlaceholderText(/search packages/i)).toBeInTheDocument()
    expect(screen.getByTestId("package-row-2")).toBeInTheDocument()
  })

  it("filters the package list when a search term is entered", async () => {
    const user = userEvent.setup()
    render(<PackagesTab />)
    await waitFor(() => screen.getByTestId("package-row-1"))

    await user.type(screen.getByPlaceholderText(/search packages/i), "brand")

    expect(screen.getByTestId("package-row-1")).toBeInTheDocument()
    expect(screen.queryByTestId("package-row-2")).not.toBeInTheDocument()
  })

  it("shows the composition panel when a package row is clicked", async () => {
    const user = userEvent.setup()
    render(<PackagesTab />)
    await waitFor(() => screen.getByTestId("package-row-1"))

    await user.click(screen.getByTestId("package-row-1"))

    await waitFor(() => expect(screen.getByTestId("package-composition-panel")).toBeInTheDocument())
  })

  it("calls PATCH and updates the visibility badge when the badge is clicked", async () => {
    mockPatch.mockResolvedValue({
      data: { id: 1, name: "Brand Tracker", slug: "brand-tracker", visibility: "public" },
    } as never)

    const user = userEvent.setup()
    render(<PackagesTab />)
    await waitFor(() => screen.getByTestId("package-composition-panel"))

    await user.click(screen.getByTitle(/click to toggle visibility/i))

    expect(mockPatch).toHaveBeenCalledWith(
      "/api/v1/admin/packages/{package_id}",
      expect.objectContaining({ body: { visibility: "public" } }),
    )
    await waitFor(() => expect(screen.getByText("public")).toBeInTheDocument())
  })
})
