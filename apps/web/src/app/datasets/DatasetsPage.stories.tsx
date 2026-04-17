import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { vi } from "@storybook/test"
import { DatasetsPage } from "./DatasetsPage"

const meta: Meta<typeof DatasetsPage> = {
  title: "Datasets/DatasetsPage",
  component: DatasetsPage,
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof DatasetsPage>

const MOCK_DATASETS = [
  {
    id: 1,
    name: "Wave 1",
    collection_id: 1,
    collected_at: "2025-01",
    created_at: "2025-01-15T00:00:00Z",
  },
  {
    id: 2,
    name: "Wave 2",
    collection_id: 1,
    collected_at: "2025-07",
    created_at: "2025-07-10T00:00:00Z",
  },
]

// Empty state — no datasets yet
export const Empty: Story = {
  beforeEach() {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )
  },
}

// Populated table with two datasets
export const WithData: Story = {
  beforeEach() {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: MOCK_DATASETS }), { status: 200 }),
    )
  },
}
