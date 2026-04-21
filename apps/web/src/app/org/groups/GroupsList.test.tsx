import { render, screen, waitFor, within } from "@testing-library/react"
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
import { GroupsList } from "./GroupsList"

const mockGet = vi.mocked(api.GET)
const mockPost = vi.mocked(api.POST)
const mockDelete = vi.mocked(api.DELETE)

const mockGroups = [
  { id: 1, name: "Analysts", is_default: false, member_count: 3, package_count: 2 },
  { id: 2, name: "Default", is_default: true, member_count: 10, package_count: 5 },
]

describe("GroupsList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOrganization).mockReturnValue({
      membership: { role: "org:admin" },
    } as ReturnType<typeof useOrganization>)
    mockGet.mockResolvedValue({ data: mockGroups } as never)
  })

  it("renders all groups fetched from the API", async () => {
    render(<GroupsList selectedGroupId={null} onSelect={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText("Analysts")).toBeInTheDocument()
      expect(screen.getByText("Default")).toBeInTheDocument()
    })
  })

  it("filters groups by search term", async () => {
    const user = userEvent.setup()
    render(<GroupsList selectedGroupId={null} onSelect={vi.fn()} />)
    await waitFor(() => screen.getByText("Analysts"))

    await user.type(screen.getByRole("textbox", { name: /search groups/i }), "ana")

    expect(screen.getByText("Analysts")).toBeInTheDocument()
    expect(screen.queryByText("Default")).not.toBeInTheDocument()
  })

  it("shows the + New button when the user is an org admin", async () => {
    render(<GroupsList selectedGroupId={null} onSelect={vi.fn()} />)
    await waitFor(() => screen.getByText("Analysts"))
    expect(screen.getByRole("button", { name: /\+ new/i })).toBeInTheDocument()
  })

  it("hides the + New button when the user is not an admin", async () => {
    vi.mocked(useOrganization).mockReturnValue({
      membership: { role: "org:member" },
    } as ReturnType<typeof useOrganization>)
    render(<GroupsList selectedGroupId={null} onSelect={vi.fn()} />)
    await waitFor(() => screen.getByText("Analysts"))
    expect(screen.queryByRole("button", { name: /\+ new/i })).not.toBeInTheDocument()
  })

  it("opens create dialog and calls POST when a group name is submitted", async () => {
    mockPost.mockResolvedValue({
      data: { id: 3, name: "New Group", is_default: false, member_count: 0, package_count: 0 },
    } as never)
    mockGet.mockResolvedValueOnce({ data: mockGroups } as never).mockResolvedValueOnce({
      data: [
        ...mockGroups,
        { id: 3, name: "New Group", is_default: false, member_count: 0, package_count: 0 },
      ],
    } as never)

    const user = userEvent.setup()
    render(<GroupsList selectedGroupId={null} onSelect={vi.fn()} />)
    await waitFor(() => screen.getByText("Analysts"))

    await user.click(screen.getByRole("button", { name: /\+ new/i }))
    await user.type(screen.getByRole("textbox", { name: /group name/i }), "New Group")
    await user.click(screen.getByRole("button", { name: /^create$/i }))

    expect(mockPost).toHaveBeenCalledWith("/api/v1/groups", { body: { name: "New Group" } })
  })

  it("calls DELETE and refreshes after confirming group deletion", async () => {
    mockDelete.mockResolvedValue({} as never)
    mockGet
      .mockResolvedValueOnce({ data: mockGroups } as never)
      .mockResolvedValueOnce({ data: [mockGroups[1]] } as never)

    const user = userEvent.setup()
    render(<GroupsList selectedGroupId={null} onSelect={vi.fn()} />)
    await waitFor(() => screen.getByText("Analysts"))

    const groupRows = screen.getAllByTestId("group-row")
    const analystsRow = groupRows.find((r) => r.textContent?.includes("Analysts"))!
    await user.click(within(analystsRow).getByText(/delete/i))
    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }))

    expect(mockDelete).toHaveBeenCalledWith("/api/v1/groups/{group_id}", {
      params: { path: { group_id: 1 } },
    })
  })
})
