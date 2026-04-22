import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { TokenList } from "./TokenList"

const meta: Meta<typeof TokenList> = {
  title: "Account/TokenList",
  component: TokenList,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: { onRevoke: async () => {} },
}
export default meta
type Story = StoryObj<typeof TokenList>

const now = Date.now()
const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString()

export const Empty: Story = { args: { tokens: [] } }

export const OneToken: Story = {
  args: {
    tokens: [
      {
        id: 1,
        name: "Claude Desktop",
        prefix: "eggsec_1a2b3c4",
        created_at: iso(3),
        last_used_at: iso(0.02),
      },
    ],
  },
}

export const MultipleTokens: Story = {
  args: {
    tokens: [
      {
        id: 1,
        name: "Claude Desktop",
        prefix: "eggsec_1a2b3c4",
        created_at: iso(3),
        last_used_at: iso(0.02),
      },
      {
        id: 2,
        name: "Claude Code (laptop)",
        prefix: "eggsec_9z8y7x6",
        created_at: iso(14),
        last_used_at: null,
      },
    ],
  },
}
