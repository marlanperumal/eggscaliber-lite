import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  type DatasetItem,
  DatasetsPageContent,
  type DraftItem,
  type Package,
} from "./DatasetsPageContent"

const meta: Meta<typeof DatasetsPageContent> = {
  title: "Datasets/DatasetsPage",
  component: DatasetsPageContent,
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof DatasetsPageContent>

const PACKAGES: Package[] = [
  { id: 1, name: "Research" },
  { id: 2, name: "Brand Tracker" },
]

const DATASETS: DatasetItem[] = [
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
]

const DRAFTS: DraftItem[] = [
  {
    id: 5,
    status: "editing",
    dataset_name: "Wave 3 (draft)",
    collection_name: "Brand Tracker",
    package_name: "Research",
    created_at: "2025-10-01T00:00:00Z",
  },
]

export const WithData: Story = {
  args: {
    initialPackages: PACKAGES,
    initialDrafts: [],
    initialDatasets: DATASETS,
  },
}

export const WithDraft: Story = {
  args: {
    initialPackages: PACKAGES,
    initialDrafts: DRAFTS,
    initialDatasets: DATASETS,
  },
}

export const Empty: Story = {
  args: {
    initialPackages: PACKAGES,
    initialDrafts: [],
    initialDatasets: [],
  },
}
