import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { HttpResponse, http } from "msw"
import { PackagesTab } from "./PackagesTab"

const MOCK_PACKAGES = [
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

const MOCK_COLLECTIONS = [
  {
    id: 1,
    name: "Quarterly Survey",
    slug: "quarterly-survey",
    description: null,
    collection_type: "generic",
    created_at: "2024-01-01T00:00:00Z",
  },
]

const meta = {
  component: PackagesTab,
  parameters: {
    msw: {
      handlers: [
        http.get("http://localhost:8000/api/v1/admin/packages", () =>
          HttpResponse.json(MOCK_PACKAGES),
        ),
        http.get("http://localhost:8000/api/v1/admin/packages/:package_id/collections", () =>
          HttpResponse.json([]),
        ),
        http.get("http://localhost:8000/api/v1/admin/collections", () =>
          HttpResponse.json(MOCK_COLLECTIONS),
        ),
      ],
    },
  },
} satisfies Meta<typeof PackagesTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
