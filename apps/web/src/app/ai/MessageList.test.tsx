import type { UIMessage } from "@ai-sdk/react"
import { render, screen, within } from "@testing-library/react"
import { beforeAll, beforeEach, expect, it, vi } from "vitest"
import { MessageList } from "./MessageList"

const scrollIntoViewMock = vi.fn()

beforeAll(() => {
  // JSDOM lacks scrollIntoView; stub so the effect doesn't throw
  Element.prototype.scrollIntoView = scrollIntoViewMock
})

beforeEach(() => {
  scrollIntoViewMock.mockClear()
})

function userMsg(id: string, text: string): UIMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
  } as UIMessage
}

function assistantMsg(id: string, text: string): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text }],
  } as UIMessage
}

it("renders empty state when messages is empty", () => {
  render(<MessageList messages={[]} isLoading={false} />)
  expect(screen.getByTestId("message-list-empty")).toHaveTextContent(/ask a question/i)
})

it("renders each message in order", () => {
  const messages = [userMsg("1", "first"), assistantMsg("2", "second"), userMsg("3", "third")]
  render(<MessageList messages={messages} isLoading={false} />)
  const list = screen.getByTestId("message-list")
  const texts = within(list).getAllByText(/first|second|third/)
  expect(texts.map((n) => n.textContent)).toEqual(["first", "second", "third"])
})

it("differentiates user vs assistant rendering via message-bubble testids", () => {
  const messages = [userMsg("1", "hello"), assistantMsg("2", "world")]
  render(<MessageList messages={messages} isLoading={false} />)
  const userBubbles = screen.getAllByTestId("message-bubble-user")
  const assistantBubbles = screen.getAllByTestId("message-bubble-assistant")
  expect(userBubbles).toHaveLength(1)
  expect(assistantBubbles).toHaveLength(1)
  expect(userBubbles[0]).toHaveTextContent("hello")
  expect(assistantBubbles[0]).toHaveTextContent("world")
})

it("renders a thinking assistant bubble when isLoading is true", () => {
  render(<MessageList messages={[userMsg("1", "hi")]} isLoading={true} />)
  const assistantBubbles = screen.getAllByTestId("message-bubble-assistant")
  expect(assistantBubbles.some((b) => /thinking/i.test(b.textContent ?? ""))).toBe(true)
})

it("scrolls to bottom when a new message arrives", () => {
  const { rerender } = render(<MessageList messages={[userMsg("1", "first")]} isLoading={false} />)
  scrollIntoViewMock.mockClear()
  rerender(
    <MessageList
      messages={[userMsg("1", "first"), assistantMsg("2", "second")]}
      isLoading={false}
    />,
  )
  expect(scrollIntoViewMock).toHaveBeenCalled()
})
