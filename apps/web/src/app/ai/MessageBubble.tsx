import type { ReactNode } from "react"

interface Props {
  sender: "user" | "assistant"
  content: ReactNode
}

export function MessageBubble({ sender, content }: Props) {
  const isUser = sender === "user"
  return (
    <div
      data-testid={`message-bubble-${sender}`}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-card-foreground"
        }`}
      >
        {content}
      </div>
    </div>
  )
}
