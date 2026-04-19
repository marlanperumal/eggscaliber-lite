import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { HttpResponse, http } from "msw"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AnalyticsLayout } from "./AnalyticsLayout"

const MOCK_SCOPE = [
  {
    id: 1,
    name: "Brand Tracker",

    collections: [
      {
        id: 1,
        name: "Quarterly Survey",
        datasets: [
          { id: 1, name: "Wave 1" },
          { id: 2, name: "Wave 2" },
        ],
      },
    ],
  },
]

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
  parameters: {
    msw: {
      handlers: [
        http.get("http://localhost:8000/api/v1/scope", () => HttpResponse.json(MOCK_SCOPE)),
      ],
    },
  },
}
