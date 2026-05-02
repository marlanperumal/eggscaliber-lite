import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import { ApiTokensSection } from "./ApiTokensSection"

vi.mock("@/lib/use-get-token", () => ({
  useGetToken: () => vi.fn().mockResolvedValue("dev-token"),
}))

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}))

const mockGet = vi.mocked(api.GET)
const mockPost = vi.mocked(api.POST)

beforeEach(() => {
  vi.clearAllMocks()
  // Default: empty tokens list
  mockGet.mockResolvedValue({ data: [], response: new Response() } as never)
})

it("shows empty state when no tokens are returned", async () => {
  render(<ApiTokensSection />)
  expect(await screen.findByText(/no active tokens/i)).toBeInTheDocument()
})

it("clicking the New Token button reveals the generate form", async () => {
  const user = userEvent.setup()
  render(<ApiTokensSection />)
  await screen.findByText(/no active tokens/i)
  await user.click(screen.getByRole("button", { name: "New Token" }))
  expect(screen.getByLabelText("Token name")).toBeInTheDocument()
})

it("submitting the form calls api.POST and reveals the raw token", async () => {
  const user = userEvent.setup()
  mockPost.mockResolvedValue({
    data: {
      id: 1,
      name: "My Token",
      prefix: "ek_xxxxx",
      raw_token: "ek_xxxxx_secret_full_token",
      created_at: new Date().toISOString(),
      last_used_at: null,
    },
    response: new Response(),
  } as never)

  render(<ApiTokensSection />)
  await screen.findByText(/no active tokens/i)
  await user.click(screen.getByRole("button", { name: "New Token" }))
  await user.type(screen.getByLabelText("Token name"), "My Token")
  await user.click(screen.getByRole("button", { name: "Generate" }))

  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/tokens",
      expect.objectContaining({ body: { name: "My Token" } }),
    )
  })
  // TokenRevealCallout renders the raw token via data-testid
  expect(await screen.findByTestId("raw-token")).toHaveTextContent("ek_xxxxx_secret_full_token")
})

it("on successful generation the token list is refetched", async () => {
  const user = userEvent.setup()
  mockPost.mockResolvedValue({
    data: {
      id: 1,
      name: "My Token",
      prefix: "ek_xxxxx",
      raw_token: "ek_xxxxx_full",
      created_at: new Date().toISOString(),
      last_used_at: null,
    },
    response: new Response(),
  } as never)

  render(<ApiTokensSection />)
  await screen.findByText(/no active tokens/i)
  // Initial mount triggered one GET
  const initialCalls = mockGet.mock.calls.length

  await user.click(screen.getByRole("button", { name: "New Token" }))
  await user.type(screen.getByLabelText("Token name"), "My Token")
  await user.click(screen.getByRole("button", { name: "Generate" }))

  await waitFor(() => {
    expect(mockGet.mock.calls.length).toBeGreaterThan(initialCalls)
  })
})
