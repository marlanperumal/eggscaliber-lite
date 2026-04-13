import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

const meta = {
  title: "UI/ToggleGroup",
  component: ToggleGroup,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ToggleGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Measure: Story = {
  args: {
    type: "single",
    defaultValue: "count",
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="count">Count</ToggleGroupItem>
      <ToggleGroupItem value="weighted">Weighted</ToggleGroupItem>
      <ToggleGroupItem value="value">Value</ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const Display: Story = {
  args: {
    type: "single",
    defaultValue: "n",
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="n">N</ToggleGroupItem>
      <ToggleGroupItem value="pct_col">% Col</ToggleGroupItem>
      <ToggleGroupItem value="pct_row">% Row</ToggleGroupItem>
    </ToggleGroup>
  ),
}
