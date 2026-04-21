"use client"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { FormEvent } from "react"
import { useState } from "react"
import { ChatInput } from "./ChatInput"
import { MessageList } from "./MessageList"

export function AIChatPage() {
  const [input, setInput] = useState("")
  const [key, setKey] = useState(0)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/ai/chat`,
    }),
  })

  const isLoading = status === "submitted" || status === "streaming"

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput("")
  }

  return (
    <div key={key} data-testid="ai-chat-page" className="flex h-full flex-col">
      {error && (
        <div className="flex items-center gap-3 border-border border-b bg-destructive/10 px-4 py-2 text-destructive text-sm">
          <span>Something went wrong.</span>
          <button
            type="button"
            onClick={() => setKey((k) => k + 1)}
            className="underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput
        input={input}
        isLoading={isLoading}
        onInputChange={(value) => setInput(value)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
