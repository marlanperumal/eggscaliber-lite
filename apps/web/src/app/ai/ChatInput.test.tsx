import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ChatInput } from "./ChatInput"

describe("ChatInput", () => {
  it("calls onSubmit when Enter is pressed", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e) => e.preventDefault())
    render(
      <ChatInput input="hello" isLoading={false} onInputChange={vi.fn()} onSubmit={onSubmit} />,
    )
    await user.click(screen.getByTestId("chat-input"))
    await user.keyboard("{Enter}")
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it("does not call onSubmit when Shift+Enter is pressed", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e) => e.preventDefault())
    render(
      <ChatInput input="hello" isLoading={false} onInputChange={vi.fn()} onSubmit={onSubmit} />,
    )
    await user.click(screen.getByTestId("chat-input"))
    await user.keyboard("{Shift>}{Enter}{/Shift}")
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("disables textarea and button when isLoading is true", () => {
    render(<ChatInput input="" isLoading={true} onInputChange={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByTestId("chat-input")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })
})
