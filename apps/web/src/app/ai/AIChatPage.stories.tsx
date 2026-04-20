import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { HttpResponse, http } from "msw"
import { AIChatPage } from "./AIChatPage"

const chatHandlers = [
  http.post(
    /\/api\/v1\/ai\/chat/,
    () =>
      new HttpResponse('0:"Hello from the AI assistant."\nd:{"finishReason":"stop"}\n', {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Vercel-AI-Data-Stream": "v1",
        },
      }),
  ),
]

const meta = {
  component: AIChatPage,
  parameters: {
    msw: { handlers: chatHandlers },
  },
} satisfies Meta<typeof AIChatPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
