import type { Meta, StoryFn } from "@storybook/nextjs-vite"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

const meta = {
  title: "UI/ToggleGroup",
  component: ToggleGroup,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ToggleGroup>

export default meta

export const Measure: StoryFn = () => (
  <ToggleGroup type="single" defaultValue="count">
    <ToggleGroupItem value="count">Count</ToggleGroupItem>
    <ToggleGroupItem value="weighted">Weighted</ToggleGroupItem>
    <ToggleGroupItem value="value">Value</ToggleGroupItem>
  </ToggleGroup>
)

export const Display: StoryFn = () => (
  <ToggleGroup type="single" defaultValue="n">
    <ToggleGroupItem value="n">N</ToggleGroupItem>
    <ToggleGroupItem value="pct_col">% Col</ToggleGroupItem>
    <ToggleGroupItem value="pct_row">% Row</ToggleGroupItem>
  </ToggleGroup>
)
