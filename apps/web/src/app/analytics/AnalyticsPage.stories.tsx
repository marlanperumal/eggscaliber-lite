import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AnalyticsLayout } from "./AnalyticsLayout"

const meta = {
  title: "Analytics/AnalyticsPage",
  component: AnalyticsLayout,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full analytics page — field tree, query builder, and results panel. " +
          "Requires the dev API to be running (`just api`) with seed data (`just db-seed`) " +
          "for dataset/field loading to work.",
      },
    },
  },
  decorators: [
    (Story) => (
      <NuqsTestingAdapter>
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          <Story />
        </div>
      </NuqsTestingAdapter>
    ),
  ],
} satisfies Meta<typeof AnalyticsLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: "Full analytics page",
}
