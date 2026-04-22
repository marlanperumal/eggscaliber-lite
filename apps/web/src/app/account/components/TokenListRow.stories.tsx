import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { TokenListRow } from "./TokenListRow"

const meta: Meta<typeof TokenListRow> = {
  title: "Account/TokenListRow",
  component: TokenListRow,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: {
    id: 1,
    name: "Claude Desktop",
    prefix: "eggsec_1a2b3c4",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    onRevoke: async () => {},
  },
}
export default meta
type Story = StoryObj<typeof TokenListRow>

export const NeverUsed: Story = {}
export const WithLastUsed: Story = {
  args: { lastUsedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
}
