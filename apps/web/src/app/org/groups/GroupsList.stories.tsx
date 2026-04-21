import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { GroupsList } from "./GroupsList"

const meta = {
  component: GroupsList,
  args: {
    selectedGroupId: null,
    onSelect: () => {},
  },
} satisfies Meta<typeof GroupsList>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithGroups: Story = {
  args: { selectedGroupId: 2 },
}
