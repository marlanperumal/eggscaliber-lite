import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@clerk/nextjs", () => ({
  useOrganization: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}))

import { useOrganization } from "@clerk/nextjs"
import { api } from "@/lib/api"
import { PackagesPanel } from "./PackagesPanel"

const mockGet = vi.mocked(api.GET)
const mockPost = vi.mocked(api.POST)
const mockDelete = vi.mocked(api.DELETE)

const mockOrgPackages = [
  { id: 1, name: "Public Pkg", slug: "public-pkg", visibility: "public" },
  { id: 2, name: "Private Pkg", slug: "private-pkg", visibility: "private" },
]

describe("PackagesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOrganization).mockReturnValue({
      membership: { role: "org:admin" },
    } as ReturnType<typeof useOrganization>)
  })

  it("shows a select-group prompt when groupId is null", () => {
    mockGet.mockResolvedValue({ data: mockOrgPackages } as never)
    render(<PackagesPanel groupId={null} />)
    expect(screen.getByTestId("packages-panel")).toHaveTextContent(/select a group/i)
  })

  it("renders package rows with Grant/Granted state after loading", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/org/subscriptions")
        return Promise.resolve({ data: mockOrgPackages } as never)
      return Promise.resolve({ data: [{ package_id: 2 }] } as never)
    })
    render(<PackagesPanel groupId={5} />)
    await waitFor(() => {
      expect(screen.getAllByTestId("package-row")).toHaveLength(2)
    })
    expect(screen.getByRole("button", { name: /^grant$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^granted$/i })).toBeInTheDocument()
  })

  it("calls POST and shows Granted when a package is granted", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/org/subscriptions")
        return Promise.resolve({ data: mockOrgPackages } as never)
      return Promise.resolve({ data: [] } as never)
    })
    mockPost.mockResolvedValue({} as never)

    const user = userEvent.setup()
    render(<PackagesPanel groupId={5} />)
    await waitFor(() => screen.getAllByRole("button", { name: /^grant$/i }))

    await user.click(screen.getAllByRole("button", { name: /^grant$/i })[0])

    expect(mockPost).toHaveBeenCalledWith("/api/v1/groups/{group_id}/packages", {
      params: { path: { group_id: 5 } },
      body: { package_id: 1 },
    })
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /^granted$/i })[0]).toBeInTheDocument(),
    )
  })

  it("calls DELETE and shows Grant when a granted package is revoked", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/org/subscriptions")
        return Promise.resolve({ data: mockOrgPackages } as never)
      return Promise.resolve({ data: [{ package_id: 1 }, { package_id: 2 }] } as never)
    })
    mockDelete.mockResolvedValue({} as never)

    const user = userEvent.setup()
    render(<PackagesPanel groupId={5} />)
    await waitFor(() => screen.getAllByRole("button", { name: /^granted$/i }))

    await user.click(screen.getAllByRole("button", { name: /^granted$/i })[0])

    expect(mockDelete).toHaveBeenCalledWith("/api/v1/groups/{group_id}/packages/{package_id}", {
      params: { path: { group_id: 5, package_id: 1 } },
    })
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /^grant$/i })[0]).toBeInTheDocument(),
    )
  })

  it("shows read-only grant status text instead of buttons when user is not an org admin", async () => {
    vi.mocked(useOrganization).mockReturnValue({
      membership: { role: "org:member" },
    } as ReturnType<typeof useOrganization>)
    const mockOrgPackages = [
      { id: 1, name: "Public Pkg", slug: "public-pkg", visibility: "public" },
      { id: 2, name: "Private Pkg", slug: "private-pkg", visibility: "private" },
    ]
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/org/subscriptions")
        return Promise.resolve({ data: mockOrgPackages } as never)
      // package 2 is granted
      return Promise.resolve({ data: [{ package_id: 2 }] } as never)
    })

    render(<PackagesPanel groupId={5} />)
    await waitFor(() => screen.getAllByTestId("package-row"))

    // No clickable Grant/Granted buttons — interactive buttons are admin-only
    expect(screen.queryByRole("button", { name: /^grant$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^granted$/i })).not.toBeInTheDocument()
    // Read-only text shows the access state instead
    expect(screen.getByText("Granted")).toBeInTheDocument()
    expect(screen.getByText("No access")).toBeInTheDocument()
  })
})
