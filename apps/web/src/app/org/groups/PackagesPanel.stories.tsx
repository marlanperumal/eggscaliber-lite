import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { PackagesPanel } from "./PackagesPanel"

const meta = {
  component: PackagesPanel,
  args: { groupId: null },
} satisfies Meta<typeof PackagesPanel>

export default meta
type Story = StoryObj<typeof meta>

export const NoGroupSelected: Story = {}
export const WithGroup: Story = { args: { groupId: 1 } }
