import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { MembersPanel } from "./MembersPanel"

const meta = {
  component: MembersPanel,
  args: { groupId: null, isDefault: false },
} satisfies Meta<typeof MembersPanel>

export default meta
type Story = StoryObj<typeof meta>

export const NoGroupSelected: Story = {}

export const DefaultGroup: Story = {
  args: { groupId: 1, isDefault: true },
}

export const AdminView: Story = {
  args: { groupId: 2, isDefault: false },
}
