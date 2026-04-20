"use client"
import type { UIMessage } from "@ai-sdk/react"
import { useEffect, useRef } from "react"
import { AssistantMessage } from "./AssistantMessage"
import { MessageBubble } from "./MessageBubble"

interface Props {
  messages: UIMessage[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastMessageId = messages.at(-1)?.id

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lastMessageId, isLoading])

  if (messages.length === 0) {
    return (
      <div
        data-testid="message-list-empty"
        className="flex flex-1 items-center justify-center text-muted-foreground text-sm"
      >
        Ask a question to get started.
      </div>
    )
  }

  return (
    <div data-testid="message-list" className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {messages.map((msg) =>
        msg.role === "user" ? (
          <MessageBubble
            key={msg.id}
            sender="user"
            content={msg.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as { type: "text"; text: string }).text)
              .join("")}
          />
        ) : (
          <MessageBubble
            key={msg.id}
            sender="assistant"
            content={<AssistantMessage message={msg} />}
          />
        ),
      )}
      {isLoading && (
        <MessageBubble
          sender="assistant"
          content={<span className="text-muted-foreground text-sm italic">Thinking…</span>}
        />
      )}
      <div ref={bottomRef} />
    </div>
  )
}
