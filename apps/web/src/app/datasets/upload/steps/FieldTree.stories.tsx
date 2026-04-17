import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { FieldTree } from "./FieldTree"

const meta: Meta<typeof FieldTree> = {
  title: "Datasets/Upload/FieldTree",
  component: FieldTree,
}
export default meta
type Story = StoryObj<typeof FieldTree>

const GROUPS = [
  { id: 1, name: "Brand Tracker", parent_id: null, sort_order: 0 },
  { id: 2, name: "Awareness", parent_id: 1, sort_order: 0 },
  { id: 3, name: "Demographics", parent_id: null, sort_order: 1 },
]

const FIELDS = [
  {
    id: 1,
    field_key: "brand_awareness",
    display_name: "Brand Awareness",
    detected_type: "categorical",
    override_type: null,
    sort_order: 0,
    upload_fieldgroup_id: 2,
    levels: [],
  },
  {
    id: 2,
    field_key: "gender",
    display_name: "Gender",
    detected_type: "categorical",
    override_type: null,
    sort_order: 1,
    upload_fieldgroup_id: 3,
    levels: [],
  },
]

const UNASSIGNED = [
  {
    id: 3,
    field_key: "nps_score",
    display_name: null,
    detected_type: "numeric",
    override_type: null,
    sort_order: 2,
    upload_fieldgroup_id: null,
    levels: [],
  },
]

const baseArgs = {
  groups: GROUPS,
  fields: FIELDS,
  unassignedFields: UNASSIGNED,
  onSelectField: fn(),
  onMoveField: fn(),
  onCreateGroup: fn(),
  onRenameGroup: fn(),
  onDeleteGroup: fn(),
}

export const Default: Story = {
  args: { ...baseArgs, selectedFieldId: null },
}

export const FieldSelected: Story = {
  args: { ...baseArgs, selectedFieldId: 1 },
}
