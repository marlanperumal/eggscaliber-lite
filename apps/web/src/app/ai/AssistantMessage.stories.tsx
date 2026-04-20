import type { UIMessage } from "@ai-sdk/react"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AssistantMessage } from "./AssistantMessage"

const mockMessage = (text: string, extraParts?: UIMessage["parts"]): UIMessage => ({
  id: "1",
  role: "assistant",
  parts: [{ type: "text", text }, ...(extraParts ?? [])],
  metadata: undefined,
})

const meta = {
  component: AssistantMessage,
} satisfies Meta<typeof AssistantMessage>

export default meta
type Story = StoryObj<typeof meta>

export const TextOnly: Story = {
  args: {
    message: mockMessage("Brand awareness rose from 42% to 67% between 2022 and 2024."),
  },
}
