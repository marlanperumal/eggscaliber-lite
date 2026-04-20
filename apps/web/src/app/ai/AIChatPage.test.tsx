import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@ai-sdk/react", () => ({
  useChat: vi.fn(),
}))

vi.mock("ai", () => ({
  DefaultChatTransport: vi.fn(),
}))

import { useChat } from "@ai-sdk/react"

const mockUseChat = vi.mocked(useChat)

function makeUseChat(overrides: Partial<ReturnType<typeof useChat>>) {
  return {
    messages: [],
    sendMessage: vi.fn(),
    status: "ready" as const,
    error: undefined,
    ...overrides,
  }
}

describe("AIChatPage", () => {
  beforeEach(() => {
    mockUseChat.mockReturnValue(makeUseChat({}))
  })

  it("renders without error banner when there is no error", async () => {
    const { AIChatPage } = await import("./AIChatPage")
    render(<AIChatPage />)
    expect(screen.queryByText("Something went wrong.")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("renders error banner with Try again button when useChat returns an error", async () => {
    mockUseChat.mockReturnValue(makeUseChat({ error: new Error("stream failed") }))
    const { AIChatPage } = await import("./AIChatPage")
    render(<AIChatPage />)
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("clicking Try again remounts the component and clears the error banner", async () => {
    const user = userEvent.setup()
    mockUseChat
      .mockReturnValueOnce(makeUseChat({ error: new Error("stream failed") }))
      .mockReturnValue(makeUseChat({}))

    const { AIChatPage } = await import("./AIChatPage")
    render(<AIChatPage />)
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(screen.queryByText("Something went wrong.")).not.toBeInTheDocument()
  })
})
