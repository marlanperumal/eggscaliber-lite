import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { HttpResponse, http } from "msw"
import { FieldDetection } from "./FieldDetection"

const BASE = "http://localhost:8000"

const meta: Meta<typeof FieldDetection> = {
  title: "Datasets/Upload/FieldDetection",
  component: FieldDetection,
}
export default meta
type Story = StoryObj<typeof FieldDetection>

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

const MOCK_SESSION = {
  id: 1,
  status: "editing" as const,
  dataset_name: "Wave 3",
  row_count: 847,
  collection_id: 1,
  collection_name: "Brand Tracker",
  package_name: "Research",
  collected_at: "2025-10-01T00:00:00Z",
  file_name: "wave3.csv",
  fields: MOCK_FIELDS,
}

export const WithFields: Story = {
  args: {
    state: { step: 2 as const, sessionId: 1, needsReconcile: false },
    setStep: fn(),
  },
  parameters: {
    msw: {
      handlers: [http.get(`${BASE}/api/v1/uploads/:id`, () => HttpResponse.json(MOCK_SESSION))],
    },
  },
}
