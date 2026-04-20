"use client"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { FormEvent } from "react"
import { useState } from "react"
import { ChatInput } from "./ChatInput"
import { MessageList } from "./MessageList"

export function AIChatPage() {
  const [input, setInput] = useState("")

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/chat`,
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
    <div data-testid="ai-chat-page" className="flex h-full flex-col">
      {error && (
        <div className="border-b border-border bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Something went wrong. Please try again.
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
