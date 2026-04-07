import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Badge } from "./badge"

const meta = {
  title: "UI/Badge",
  component: Badge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { children: "Badge" } }
export const Secondary: Story = { args: { children: "Secondary", variant: "secondary" } }
export const Destructive: Story = { args: { children: "Error", variant: "destructive" } }
export const Outline: Story = { args: { children: "Outline", variant: "outline" } }

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      {(["default", "secondary", "destructive", "outline"] as const).map((v) => (
        <Badge key={v} variant={v}>
          {v}
        </Badge>
      ))}
    </div>
  ),
}
