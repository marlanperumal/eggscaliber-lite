import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AdminPage } from "./AdminPage"

const meta = { component: AdminPage } satisfies Meta<typeof AdminPage>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
