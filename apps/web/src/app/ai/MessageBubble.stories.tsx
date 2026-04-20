import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { MessageBubble } from "./MessageBubble"

const meta = {
  component: MessageBubble,
} satisfies Meta<typeof MessageBubble>

export default meta
type Story = StoryObj<typeof meta>

export const UserMessage: Story = {
  args: { sender: "user", content: "How has brand awareness changed over time?" },
}

export const AssistantMessageBubble: Story = {
  args: {
    sender: "assistant",
    content: "Brand awareness rose from 42% to 67% between 2022 and 2024.",
  },
}
