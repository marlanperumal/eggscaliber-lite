import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AIChatPage } from "./AIChatPage"

const meta = {
  component: AIChatPage,
} satisfies Meta<typeof AIChatPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
