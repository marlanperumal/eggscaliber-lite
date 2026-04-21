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
import { MembersPanel } from "./MembersPanel"

const mockGet = vi.mocked(api.GET)
const mockPost = vi.mocked(api.POST)
const mockDelete = vi.mocked(api.DELETE)

const mockMembers = [{ user_id: 10, email: "alice@example.com", role: "admin" }]
const mockOrgMembers = [
  { user_id: 10, email: "alice@example.com", role: "admin" },
  { user_id: 11, email: "bob@example.com", role: "member" },
]

describe("MembersPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOrganization).mockReturnValue({
      membership: { role: "org:admin" },
    } as ReturnType<typeof useOrganization>)
  })

  it("shows a select-group prompt when groupId is null", () => {
    render(<MembersPanel groupId={null} isDefault={false} />)
    expect(screen.getByTestId("members-panel")).toHaveTextContent(/select a group/i)
  })

  it("renders member rows after loading", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/groups/{group_id}/members")
        return Promise.resolve({ data: mockMembers } as never)
      return Promise.resolve({ data: mockOrgMembers } as never)
    })
    render(<MembersPanel groupId={5} isDefault={false} />)
    await waitFor(() => {
      expect(screen.getByTestId("members-panel")).toHaveTextContent("alice@example.com")
    })
  })

  it("shows + Add button for admin on non-default group", async () => {
    mockGet.mockResolvedValue({ data: [] } as never)
    render(<MembersPanel groupId={5} isDefault={false} />)
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: /\+ add/i })).toBeInTheDocument()
  })

  it("hides + Add button for default group even when admin", async () => {
    mockGet.mockResolvedValue({ data: [] } as never)
    render(<MembersPanel groupId={5} isDefault={true} />)
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument())
    expect(screen.queryByRole("button", { name: /\+ add/i })).not.toBeInTheDocument()
  })

  it("shows addable org members in the add panel and calls POST on click", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/groups/{group_id}/members")
        return Promise.resolve({ data: mockMembers } as never) // alice already in group
      return Promise.resolve({ data: mockOrgMembers } as never)
    })
    mockPost.mockResolvedValue({} as never)

    const user = userEvent.setup()
    render(<MembersPanel groupId={5} isDefault={false} />)
    await waitFor(() => screen.getByRole("button", { name: /\+ add/i }))

    await user.click(screen.getByRole("button", { name: /\+ add/i }))
    // bob is addable (alice already in group)
    await waitFor(() => expect(screen.getByTestId("add-member-panel")).toBeInTheDocument())
    await user.click(screen.getByText(/bob@example.com/i))

    expect(mockPost).toHaveBeenCalledWith("/api/v1/groups/{group_id}/members", {
      params: { path: { group_id: 5 } },
      body: { user_id: 11 },
    })
  })

  it("calls DELETE and removes the member row when Remove is clicked", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/groups/{group_id}/members")
        return Promise.resolve({ data: mockMembers } as never)
      return Promise.resolve({ data: mockOrgMembers } as never)
    })
    mockDelete.mockResolvedValue({} as never)

    const user = userEvent.setup()
    render(<MembersPanel groupId={5} isDefault={false} />)
    await waitFor(() => screen.getByTestId("member-row"))

    await user.click(screen.getByRole("button", { name: /remove/i }))

    expect(mockDelete).toHaveBeenCalledWith("/api/v1/groups/{group_id}/members/{user_id}", {
      params: { path: { group_id: 5, user_id: 10 } },
    })
    await waitFor(() => expect(screen.queryByTestId("member-row")).not.toBeInTheDocument())
  })

  it("hides + Add button when user is not an org admin", async () => {
    vi.mocked(useOrganization).mockReturnValue({
      membership: { role: "org:member" },
    } as ReturnType<typeof useOrganization>)
    mockGet.mockResolvedValue({ data: [] } as never)
    render(<MembersPanel groupId={5} isDefault={false} />)
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument())
    expect(screen.queryByRole("button", { name: /\+ add/i })).not.toBeInTheDocument()
  })

  it("hides Remove buttons when user is not an org admin", async () => {
    vi.mocked(useOrganization).mockReturnValue({
      membership: { role: "org:member" },
    } as ReturnType<typeof useOrganization>)
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/v1/groups/{group_id}/members")
        return Promise.resolve({
          data: [{ user_id: 10, email: "alice@example.com", role: "admin" }],
        } as never)
      return Promise.resolve({ data: [] } as never)
    })
    render(<MembersPanel groupId={5} isDefault={false} />)
    await waitFor(() => expect(screen.getByTestId("member-row")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument()
  })
})
