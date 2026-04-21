import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { GroupsPage } from "./GroupsPage"

const meta = { component: GroupsPage } satisfies Meta<typeof GroupsPage>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
