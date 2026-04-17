import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn, vi } from "@storybook/test"
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

export const ReadyToCommit: Story = {
  args: {
    state: { step: 5 as const, sessionId: 1, needsReconcile: false },
    setStep: fn(),
  },
  beforeEach() {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_SESSION), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_TREE), { status: 200 }))
  },
}
