"use client"
import { type FormEvent, type KeyboardEvent, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  input: string
  isLoading: boolean
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

export function ChatInput({ input, isLoading, onInputChange, onSubmit }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex items-end gap-2 border-border border-t p-3"
    >
      <Textarea
        data-testid="chat-input"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your data…"
        rows={2}
        disabled={isLoading}
        className="resize-none"
      />
      <Button type="submit" disabled={isLoading || !input.trim()}>
        Send
      </Button>
    </form>
  )
}
