import type { UIMessage } from "@ai-sdk/react"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { MessageList } from "./MessageList"

const messages: UIMessage[] = [
  {
    id: "1",
    role: "user",
    parts: [{ type: "text", text: "How has brand awareness changed?" }],
    metadata: undefined,
  },
  {
    id: "2",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Brand awareness rose from 42% to 67% between Wave 1 and Wave 4.",
      },
    ],
    metadata: undefined,
  },
  {
    id: "3",
    role: "user",
    parts: [{ type: "text", text: "Break it down by gender." }],
    metadata: undefined,
  },
]

const meta = {
  component: MessageList,
  args: { isLoading: false },
} satisfies Meta<typeof MessageList>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = { args: { messages: [] } }
export const WithMessages: Story = { args: { messages } }
export const Loading: Story = { args: { messages, isLoading: true } }
