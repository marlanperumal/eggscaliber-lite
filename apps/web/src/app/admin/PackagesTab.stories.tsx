import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { PackagesTab } from "./PackagesTab"

const meta = { component: PackagesTab } satisfies Meta<typeof PackagesTab>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
