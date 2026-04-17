import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { spyOn } from "@storybook/test"
import { DatasetsPage } from "./DatasetsPage"

const meta: Meta<typeof DatasetsPage> = {
  title: "Datasets/DatasetsPage",
  component: DatasetsPage,
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof DatasetsPage>

const MOCK_PACKAGES = [
  { id: 1, name: "Brand Tracker", slug: "brand-tracker", created_at: "2025-01-01T00:00:00Z" },
]
const MOCK_DATASETS = {
  total: 2,
  page: 1,
  page_size: 50,
  items: [
    {
      id: 1,
      name: "Wave 1",
      collection_id: 1,
      collection_name: "Brand Tracker",
      package_name: "Research",
      response_count: 512,
      field_count: 34,
      collected_at: "2025-01",
      created_at: "2025-01-15T00:00:00Z",
      status: "committed",
    },
    {
      id: 2,
      name: "Wave 2",
      collection_id: 1,
      collection_name: "Brand Tracker",
      package_name: "Research",
      response_count: 623,
      field_count: 36,
      collected_at: "2025-07",
      created_at: "2025-07-10T00:00:00Z",
      status: "committed",
    },
  ],
}

export const WithData: Story = {
  beforeEach() {
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_PACKAGES), { status: 200 }))
      .mockResolvedValue(new Response(JSON.stringify(MOCK_DATASETS), { status: 200 }))
  },
}

export const Empty: Story = {
  beforeEach() {
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_PACKAGES), { status: 200 }))
      .mockResolvedValue(
        new Response(JSON.stringify({ total: 0, page: 1, page_size: 50, items: [] }), {
          status: 200,
        }),
      )
  },
}
