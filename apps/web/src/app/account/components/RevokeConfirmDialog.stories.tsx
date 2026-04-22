import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { RevokeConfirmDialog } from "./RevokeConfirmDialog"

const meta: Meta<typeof RevokeConfirmDialog> = {
  title: "Account/RevokeConfirmDialog",
  component: RevokeConfirmDialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    open: true,
    tokenName: "Claude Desktop",
    isLoading: false,
    onConfirm: () => {},
    onCancel: () => {},
  },
}
export default meta
type Story = StoryObj<typeof RevokeConfirmDialog>

export const Default: Story = {}
export const Loading: Story = { args: { isLoading: true } }
