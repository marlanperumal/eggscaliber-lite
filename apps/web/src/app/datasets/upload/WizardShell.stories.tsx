import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { HttpResponse, http } from "msw"
import { WizardShell } from "./WizardShell"

const BASE = "http://localhost:8000"

const meta: Meta<typeof WizardShell> = {
  title: "Datasets/Upload/WizardShell",
  component: WizardShell,
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof WizardShell>

const MOCK_PACKAGES = [
  { id: 1, name: "Brand Tracker", slug: "brand-tracker", created_at: "2025-01-01T00:00:00Z" },
  { id: 2, name: "Market Research", slug: "market-research", created_at: "2025-01-01T00:00:00Z" },
]

const MOCK_FIELD_TREE = {
  groups: [
    { id: 1, name: "Brand Tracker", parent_id: null, sort_order: 0, field_count: 3 },
    { id: 2, name: "Demographics", parent_id: null, sort_order: 1, field_count: 2 },
  ],
  fields: [],
  unassigned_fields: [],
}

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
  fields: [
    { detected_type: "categorical", override_type: null },
    { detected_type: "categorical", override_type: null },
    { detected_type: "ordinal", override_type: null },
    { detected_type: "numeric", override_type: null },
    { detected_type: "identifier", override_type: null },
  ],
}

// Step 1 — initial state, no session yet
export const AtStep1: Story = {
  parameters: {
    nextjs: {
      navigation: { pathname: "/datasets/upload", searchParams: new URLSearchParams("step=1") },
    },
    msw: {
      handlers: [http.get(`${BASE}/api/v1/packages`, () => HttpResponse.json(MOCK_PACKAGES))],
    },
  },
}

// Step 4 — reconciliation skipped (new collection upload)
export const AtStep4ReconcileSkipped: Story = {
  name: "Step 4 (step 3 skipped — new collection)",
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/datasets/upload",
        searchParams: new URLSearchParams("step=4&session=1&reconcile=0"),
      },
    },
    msw: {
      handlers: [
        http.get(`${BASE}/api/v1/uploads/:id/field-tree`, () => HttpResponse.json(MOCK_FIELD_TREE)),
      ],
    },
  },
}

// Step 5 — all steps done
export const AtStep5: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/datasets/upload",
        searchParams: new URLSearchParams("step=5&session=1&reconcile=1"),
      },
    },
    msw: {
      handlers: [
        http.get(`${BASE}/api/v1/uploads/:id/field-tree`, () => HttpResponse.json(MOCK_FIELD_TREE)),
        http.get(`${BASE}/api/v1/uploads/:id/reconcile/counts`, () =>
          HttpResponse.json({
            exact: 12,
            confirmed: 3,
            new_only: 2,
            status_counts: { excluded: 0 },
          }),
        ),
        http.get(`${BASE}/api/v1/uploads/:id/suggested-reference`, () =>
          HttpResponse.json({ dataset_name: "Wave 2" }),
        ),
        http.get(`${BASE}/api/v1/uploads/:id/reconcile`, () => HttpResponse.json({ items: [] })),
        http.get(`${BASE}/api/v1/uploads/:id`, () => HttpResponse.json(MOCK_SESSION)),
      ],
    },
  },
}
