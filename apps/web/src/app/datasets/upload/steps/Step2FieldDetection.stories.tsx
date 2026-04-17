import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn, spyOn } from "@storybook/test"
import { Step2FieldDetection } from "./Step2FieldDetection"

const meta: Meta<typeof Step2FieldDetection> = {
  title: "Datasets/Upload/Step2FieldDetection",
  component: Step2FieldDetection,
}
export default meta
type Story = StoryObj<typeof Step2FieldDetection>

const MOCK_FIELDS = [
  {
    id: 1,
    field_key: "respondent_id",
    detected_type: "identifier",
    override_type: null,
    sort_order: 0,
    confidence: "high",
    value_sample: [],
  },
  {
    id: 2,
    field_key: "gender",
    detected_type: "categorical",
    override_type: null,
    sort_order: 1,
    confidence: "high",
    value_sample: ["male", "female", "prefer_not_to_say"],
  },
  {
    id: 3,
    field_key: "age",
    detected_type: "ordinal",
    override_type: null,
    sort_order: 2,
    confidence: "high",
    value_sample: ["1", "2", "3", "4", "5"],
  },
  {
    id: 4,
    field_key: "open_text_other",
    detected_type: "categorical",
    override_type: null,
    sort_order: 3,
    confidence: "review",
    value_sample: ["some text", "another answer"],
  },
  {
    id: 5,
    field_key: "net_promoter_score",
    detected_type: "numeric",
    override_type: null,
    sort_order: 4,
    confidence: "high",
    value_sample: ["7", "8", "9", "10"],
  },
]

export const WithFields: Story = {
  args: {
    state: { step: 2 as const, sessionId: 1, needsReconcile: false },
    setStep: fn(),
  },
  beforeEach() {
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ fields: MOCK_FIELDS }), { status: 200 }),
    )
  },
}
