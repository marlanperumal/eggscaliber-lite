import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { HttpResponse, http } from "msw"
import { AIChatPage } from "./AIChatPage"

const chatHandlers = [
  http.post(
    /\/api\/v1\/ai\/chat/,
    () =>
      new HttpResponse(
        'data: {"type":"start"}\n\ndata: {"type":"start-step"}\n\ndata: {"type":"text-start","id":"msg_1"}\n\ndata: {"type":"text-delta","id":"msg_1","delta":"Hello from the AI assistant."}\n\ndata: {"type":"text-end","id":"msg_1"}\n\ndata: {"type":"finish-step"}\n\ndata: {"type":"finish","finishReason":"stop"}\n\n',
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "x-vercel-ai-ui-message-stream": "v1",
          },
        },
      ),
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
