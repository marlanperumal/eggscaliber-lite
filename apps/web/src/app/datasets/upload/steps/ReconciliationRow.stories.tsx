import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { ReconciliationRow } from "./ReconciliationRow"

const meta = {
  title: "Datasets/Upload/ReconciliationRow",
  component: ReconciliationRow,
} satisfies Meta<typeof ReconciliationRow>
export default meta
type Story = StoryObj<typeof meta>

const base = { checked: false, onCheck: fn(), onAction: fn() }

export const Exact: Story = {
  args: {
    ...base,
    row: {
      id: 1,
      group: "exact",
      status: "auto_accepted",
      upload_field_id: 1,
      ref_field_id: 1,
      confidence: 1,
      note: null,
      field_key: "gender",
      ref_field_key: "gender",
      field_type: "categorical",
    },
  },
}

export const ProbablePending: Story = {
  args: {
    ...base,
    row: {
      id: 2,
      group: "probable",
      status: "pending",
      upload_field_id: 2,
      ref_field_id: 3,
      confidence: 0.85,
      note: "key renamed",
      field_key: "brand_awareness",
      ref_field_key: "awareness",
      field_type: "categorical",
    },
  },
}

export const OldOnlyPending: Story = {
  args: {
    ...base,
    row: {
      id: 3,
      group: "old_only",
      status: "pending",
      upload_field_id: null,
      ref_field_id: 4,
      confidence: null,
      note: null,
      field_key: undefined,
      ref_field_key: "region",
      field_type: "categorical",
    },
  },
}

export const NewOnly: Story = {
  args: {
    ...base,
    row: {
      id: 4,
      group: "new_only",
      status: "auto_accepted",
      upload_field_id: 5,
      ref_field_id: null,
      confidence: null,
      note: null,
      field_key: "nps_score",
      ref_field_key: undefined,
      field_type: "numeric",
    },
  },
}
