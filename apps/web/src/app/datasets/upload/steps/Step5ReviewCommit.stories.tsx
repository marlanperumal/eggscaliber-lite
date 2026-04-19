import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { HttpResponse, http } from "msw"
import { Step5ReviewCommit } from "./Step5ReviewCommit"

const BASE = "http://localhost:8000"

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
  collection_name: "Brand Tracker",
  package_name: "Research",
  collected_at: "2025-10-01T00:00:00Z",
  file_name: "wave3.csv",
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
    { id: 1, name: "Brand Tracker", parent_id: null, sort_order: 0, field_count: 3 },
    { id: 2, name: "Demographics", parent_id: null, sort_order: 1, field_count: 2 },
  ],
  unassigned_fields: [],
}
const MOCK_COUNTS = {
  exact: 12,
  confirmed: 2,
  probable: 0,
  new_only: 3,
  old_only: 1,
  status_counts: { excluded: 1 },
}
const MOCK_SUGGESTED = { dataset_id: 5, dataset_name: "Wave 2" }
const MOCK_OLD_ONLY = {
  items: [
    {
      status: "excluded",
      field_key: "legacy_brand_score",
      ref_field_key: "legacy_brand_score",
    },
  ],
  next_cursor: null,
}

export const WithReconciliation: Story = {
  args: {
    state: { step: 5 as const, sessionId: 1, needsReconcile: true },
    setStep: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get(`${BASE}/api/v1/uploads/:id/field-tree`, () => HttpResponse.json(MOCK_TREE)),
        http.get(`${BASE}/api/v1/uploads/:id/reconcile/counts`, () =>
          HttpResponse.json(MOCK_COUNTS),
        ),
        http.get(`${BASE}/api/v1/uploads/:id/suggested-reference`, () =>
          HttpResponse.json(MOCK_SUGGESTED),
        ),
        http.get(`${BASE}/api/v1/uploads/:id/reconcile`, () => HttpResponse.json(MOCK_OLD_ONLY)),
        http.get(`${BASE}/api/v1/uploads/:id`, () => HttpResponse.json(MOCK_SESSION)),
      ],
    },
  },
}

export const ReadyToCommit: Story = {
  args: {
    state: { step: 5 as const, sessionId: 1, needsReconcile: false },
    setStep: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get(`${BASE}/api/v1/uploads/:id/field-tree`, () => HttpResponse.json(MOCK_TREE)),
        http.get(`${BASE}/api/v1/uploads/:id`, () => HttpResponse.json(MOCK_SESSION)),
      ],
    },
  },
}
