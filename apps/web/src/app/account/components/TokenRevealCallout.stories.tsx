import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { TokenRevealCallout } from "./TokenRevealCallout"

const meta: Meta<typeof TokenRevealCallout> = {
  title: "Account/TokenRevealCallout",
  component: TokenRevealCallout,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: {
    rawToken: "eggsec_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
    onDismiss: () => {},
  },
}
export default meta
type Story = StoryObj<typeof TokenRevealCallout>

export const Default: Story = {}
