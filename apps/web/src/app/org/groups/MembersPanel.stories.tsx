import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { MembersPanel } from "./MembersPanel"

const meta = {
  component: MembersPanel,
  args: { groupId: null },
} satisfies Meta<typeof MembersPanel>

export default meta
type Story = StoryObj<typeof meta>

export const NoSelection: Story = {}
export const WithGroup: Story = { args: { groupId: 1 } }
