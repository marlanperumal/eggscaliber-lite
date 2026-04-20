import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MessageBubble } from "./MessageBubble"

describe("MessageBubble", () => {
  it("renders user bubble with correct testid and content", () => {
    render(<MessageBubble sender="user" content="Hello there" />)
    expect(screen.getByTestId("message-bubble-user")).toBeInTheDocument()
    expect(screen.getByText("Hello there")).toBeInTheDocument()
  })

  it("renders assistant bubble with correct testid and content", () => {
    render(<MessageBubble sender="assistant" content="Hi, I can help." />)
    expect(screen.getByTestId("message-bubble-assistant")).toBeInTheDocument()
    expect(screen.getByText("Hi, I can help.")).toBeInTheDocument()
  })

  it("renders streaming partial text as content", () => {
    render(<MessageBubble sender="assistant" content="Thinking…" />)
    expect(screen.getByText("Thinking…")).toBeInTheDocument()
  })

  it("renders ReactNode content (not just strings)", () => {
    render(
      <MessageBubble
        sender="assistant"
        content={<span data-testid="rich-content">Rich content</span>}
      />,
    )
    expect(screen.getByTestId("rich-content")).toBeInTheDocument()
  })
})
