import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn, spyOn } from "@storybook/test"
import { Step5ReviewCommit } from "./Step5ReviewCommit"

const meta: Meta<typeof Step5ReviewCommit> = {
  title: "Datasets/Upload/Step5ReviewCommit",
  component: Step5ReviewCommit,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      navigation: {
        pathname: "/datasets/upload",
        searchParams: new URLSearchParams("step=5&session=1"),
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Step5ReviewCommit>

const MOCK_SESSION = {
  dataset_name: "Wave 3",
  row_count: 847,
  collection_id: 1,
  fields: [
    { detected_type: "categorical", override_type: null },
    { detected_type: "categorical", override_type: null },
    { detected_type: "ordinal", override_type: null },
    { detected_type: "numeric", override_type: null },
    { detected_type: "identifier", override_type: null },
  ],
}
const MOCK_TREE = {
  groups: [
    { id: 1, name: "Brand Tracker", parent_id: null, sort_order: 0 },
    { id: 2, name: "Demographics", parent_id: null, sort_order: 1 },
  ],
  unassigned_fields: [],
}
const MOCK_COUNTS = { exact: 12, probable: 0, new_only: 3, old_only: 1 }
const MOCK_SUGGESTED = { dataset_id: 5, dataset_name: "Wave 2" }
const MOCK_OLD_ONLY = {
  items: [{ status: "excluded", field_key: "legacy_brand_score" }],
  next_cursor: null,
}

export const WithReconciliation: Story = {
  args: {
    state: { step: 5 as const, sessionId: 1, needsReconcile: true },
    setStep: fn(),
  },
  beforeEach() {
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_SESSION), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_TREE), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_COUNTS), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_SUGGESTED), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_OLD_ONLY), { status: 200 }))
  },
}

export const ReadyToCommit: Story = {
  args: {
    state: { step: 5 as const, sessionId: 1, needsReconcile: false },
    setStep: fn(),
  },
  beforeEach() {
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_SESSION), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_TREE), { status: 200 }))
  },
}
