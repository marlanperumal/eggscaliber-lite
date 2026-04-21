import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { HttpResponse, http } from "msw"
import { PackagesPanel } from "./PackagesPanel"

const MOCK_ORG_PACKAGES = [
  {
    id: 1,
    name: "Core Dataset",
    slug: "core-dataset",
    description: "The core data package",
    visibility: "public",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Premium Analytics",
    slug: "premium-analytics",
    description: null,
    visibility: "private",
    created_at: "2024-01-02T00:00:00Z",
  },
]

const MOCK_GROUP_PACKAGES = [
  {
    package_id: 1,
    name: "Core Dataset",
    slug: "core-dataset",
    visibility: "public",
  },
]

const meta = {
  component: PackagesPanel,
  args: { groupId: null },
  parameters: {
    msw: {
      handlers: [
        http.get("http://localhost:8000/api/v1/org/subscriptions", () =>
          HttpResponse.json(MOCK_ORG_PACKAGES),
        ),
        http.get("http://localhost:8000/api/v1/groups/:group_id/packages", () =>
          HttpResponse.json(MOCK_GROUP_PACKAGES),
        ),
      ],
    },
  },
} satisfies Meta<typeof PackagesPanel>

export default meta
type Story = StoryObj<typeof meta>

export const NoGroupSelected: Story = {}
export const WithGroup: Story = { args: { groupId: 1 } }
