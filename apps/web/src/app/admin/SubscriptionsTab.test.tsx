import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}))

import { api } from "@/lib/api"
import { SubscriptionsTab } from "./SubscriptionsTab"

const mockGet = vi.mocked(api.GET)
const mockPost = vi.mocked(api.POST)
const mockDelete = vi.mocked(api.DELETE)

const mockPackages = [
  { id: 1, name: "Public Pkg", slug: "public-pkg", visibility: "public" },
  { id: 2, name: "Private Pkg", slug: "private-pkg", visibility: "private" },
]
const mockSubscription = {
  id: 10,
  org_id: 5,
  package_id: 2,
  start_date: "2026-01-01",
  end_date: null,
}

describe("SubscriptionsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows prompt to select an organisation when orgId is null", async () => {
    mockGet.mockResolvedValue({ data: [] } as never)
    render(<SubscriptionsTab orgId={null} />)
    expect(screen.getByText(/select an organisation/i)).toBeInTheDocument()
  })

  it("shows loading spinner while fetching subscriptions", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/packages") return Promise.resolve({ data: mockPackages } as never)
      return new Promise(() => {}) as never
    })
    render(<SubscriptionsTab orgId={5} />)
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument()
  })

  it("renders a row for each package after loading", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/packages") return Promise.resolve({ data: mockPackages } as never)
      return Promise.resolve({ data: [mockSubscription] } as never)
    })
    render(<SubscriptionsTab orgId={5} />)
    await waitFor(() => {
      expect(screen.getByTestId("subscription-row-1")).toBeInTheDocument()
      expect(screen.getByTestId("subscription-row-2")).toBeInTheDocument()
    })
  })

  it("calls DELETE and removes subscribed state when toggling an active subscription off", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/packages") return Promise.resolve({ data: mockPackages } as never)
      return Promise.resolve({ data: [mockSubscription] } as never)
    })
    mockDelete.mockResolvedValue({} as never)

    const user = userEvent.setup()
    render(<SubscriptionsTab orgId={5} />)
    await waitFor(() => screen.getByTestId("subscription-row-2"))

    const toggle = screen.getByRole("button", { name: /unsubscribe private pkg/i })
    await user.click(toggle)

    expect(mockDelete).toHaveBeenCalledWith(
      "/api/v1/admin/orgs/{org_id}/subscriptions/{package_id}",
      expect.objectContaining({ params: { path: { org_id: 5, package_id: 2 } } }),
    )
  })

  it("calls POST and marks package as subscribed when toggling an unsubscribed package on", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/packages") return Promise.resolve({ data: mockPackages } as never)
      return Promise.resolve({ data: [] } as never)
    })
    mockPost.mockResolvedValue({
      data: { id: 11, org_id: 5, package_id: 1, start_date: "2026-04-21", end_date: null },
    } as never)

    const user = userEvent.setup()
    render(<SubscriptionsTab orgId={5} />)
    await waitFor(() => screen.getByTestId("subscription-row-1"))

    const toggle = screen.getByRole("button", { name: /subscribe public pkg/i })
    await user.click(toggle)

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/admin/orgs/{org_id}/subscriptions",
      expect.objectContaining({ params: { path: { org_id: 5 } } }),
    )
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /unsubscribe public pkg/i })).toBeInTheDocument(),
    )
  })
})
