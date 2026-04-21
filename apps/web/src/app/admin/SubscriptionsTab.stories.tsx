import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { SubscriptionsTab } from "./SubscriptionsTab"

const meta = {
  component: SubscriptionsTab,
  args: { orgId: null },
} satisfies Meta<typeof SubscriptionsTab>
export default meta
type Story = StoryObj<typeof meta>

export const NoOrg: Story = {}

export const WithOrg: Story = { args: { orgId: 1 } }
