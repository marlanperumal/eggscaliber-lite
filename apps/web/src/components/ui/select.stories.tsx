import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

const meta = {
  title: "UI/Select",
  component: Select,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-48" aria-label="Dataset">
        <SelectValue placeholder="Select dataset" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="wave1">Wave 1 — Jan 2024</SelectItem>
        <SelectItem value="wave2">Wave 2 — Jun 2024</SelectItem>
        <SelectItem value="wave3">Wave 3 — Mar 2025</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-48" aria-label="Dataset">
        <SelectValue placeholder="No datasets available" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="wave1">Wave 1</SelectItem>
      </SelectContent>
    </Select>
  ),
}
