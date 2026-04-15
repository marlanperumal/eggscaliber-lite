import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { EmptyState } from "./EmptyState"
import { FieldTreeIllustration } from "./illustrations/FieldTreeIllustration"
import { QueryZoneIllustration } from "./illustrations/QueryZoneIllustration"
import { ResultsIllustration } from "./illustrations/ResultsIllustration"

const meta = {
  title: "Analytics/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const FieldTree: Story = {
  name: "Field tree — no dataset",
  args: {
    illustration: <FieldTreeIllustration />,
    title: "No dataset selected",
    body: "Choose a dataset in the Query Builder to browse fields",
  },
}

export const QueryZone: Story = {
  name: "Query zone — empty drop target",
  args: {
    illustration: <QueryZoneIllustration />,
    title: "Click +R or +C to add fields",
    body: "Hover a field in the field tree to see the buttons",
  },
}

export const Results: Story = {
  name: "Results panel — no results yet",
  args: {
    illustration: <ResultsIllustration />,
    title: "No results yet",
    body: "Configure a query and press Run",
  },
}
