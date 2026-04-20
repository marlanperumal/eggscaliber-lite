import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ChatInput } from "./ChatInput"

const meta = {
  component: ChatInput,
  args: {
    input: "",
    isLoading: false,
    onInputChange: () => {},
    onSubmit: (e) => e.preventDefault(),
  },
} satisfies Meta<typeof ChatInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithText: Story = {
  args: { input: "How has brand awareness changed over time?" },
}

export const Loading: Story = {
  args: { input: "How has brand awareness changed over time?", isLoading: true },
}
