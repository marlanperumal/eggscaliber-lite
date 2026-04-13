import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Bold } from "lucide-react"
import { Toggle } from "./toggle"

const meta = {
  title: "UI/Toggle",
  component: Toggle,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["default", "outline"] },
    size: { control: "select", options: ["default", "sm", "lg"] },
  },
} satisfies Meta<typeof Toggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Toggle aria-label="Toggle bold">
      <Bold className="h-4 w-4" />
    </Toggle>
  ),
}

export const Outline: Story = {
  render: () => (
    <Toggle variant="outline" aria-label="Toggle bold">
      <Bold className="h-4 w-4" />
    </Toggle>
  ),
}

export const WithText: Story = {
  render: () => <Toggle aria-label="Toggle bold">Bold</Toggle>,
}

export const Pressed: Story = {
  render: () => (
    <Toggle defaultPressed aria-label="Toggle bold">
      <Bold className="h-4 w-4" />
    </Toggle>
  ),
}

export const Disabled: Story = {
  render: () => (
    <Toggle disabled aria-label="Toggle bold">
      <Bold className="h-4 w-4" />
    </Toggle>
  ),
}

export const Small: Story = {
  render: () => (
    <Toggle size="sm" aria-label="Toggle bold">
      <Bold className="h-4 w-4" />
    </Toggle>
  ),
}

export const Large: Story = {
  render: () => (
    <Toggle size="lg" aria-label="Toggle bold">
      <Bold className="h-4 w-4" />
    </Toggle>
  ),
}
