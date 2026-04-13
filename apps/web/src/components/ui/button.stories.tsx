import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Search } from "lucide-react"
import { Button } from "./button"

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { children: "Button" } }
export const Destructive: Story = { args: { children: "Delete", variant: "destructive" } }
export const Outline: Story = { args: { children: "Outline", variant: "outline" } }
export const Secondary: Story = { args: { children: "Secondary", variant: "secondary" } }
export const Ghost: Story = { args: { children: "Ghost", variant: "ghost" } }
export const Small: Story = { args: { children: "Small", size: "sm" } }
export const Large: Story = { args: { children: "Large", size: "lg" } }
export const Disabled: Story = { args: { children: "Disabled", disabled: true } }
// Icon button requires aria-label for accessibility
export const Icon: Story = {
  render: () => (
    <Button variant="ghost" size="icon" aria-label="Search">
      <Search className="h-4 w-4" />
    </Button>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {(["default", "destructive", "outline", "secondary", "ghost", "link"] as const).map((v) => (
        <Button key={v} variant={v}>
          {v}
        </Button>
      ))}
    </div>
  ),
}
