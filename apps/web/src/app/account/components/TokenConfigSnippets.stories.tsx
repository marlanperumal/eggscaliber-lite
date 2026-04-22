import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { TokenConfigSnippets } from "./TokenConfigSnippets"

const meta: Meta<typeof TokenConfigSnippets> = {
  title: "Account/TokenConfigSnippets",
  component: TokenConfigSnippets,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: { prefix: "eggsec_1a2b3c4" },
}
export default meta
type Story = StoryObj<typeof TokenConfigSnippets>

export const Default: Story = {}
