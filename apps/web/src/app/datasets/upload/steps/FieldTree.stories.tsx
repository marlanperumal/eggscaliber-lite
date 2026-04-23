import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { FieldTree } from "./FieldTree"

const meta = {
  title: "Datasets/Upload/FieldTree",
  component: FieldTree,
} satisfies Meta<typeof FieldTree>
export default meta
type Story = StoryObj<typeof meta>

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

// Regression fixture for deep field-group nesting (sub-project 6 spec promised ≥4 levels
// with drag-drop). Depth: Survey → Section → Battery → Question.
const DEEP_GROUPS = [
  { id: 10, name: "Brand Tracker Survey", parent_id: null, sort_order: 0 },
  { id: 11, name: "Awareness Section", parent_id: 10, sort_order: 0 },
  { id: 12, name: "Unaided Awareness Battery", parent_id: 11, sort_order: 0 },
  { id: 13, name: "Top-of-mind Brand", parent_id: 12, sort_order: 0 },
]

const DEEP_FIELDS = [
  {
    id: 101,
    field_key: "tom_brand",
    display_name: "Top-of-mind Brand",
    detected_type: "categorical",
    override_type: null,
    sort_order: 0,
    upload_fieldgroup_id: 13,
    levels: [],
  },
]

export const DeepNesting: Story = {
  name: "MetadataEditor — Deep Nesting",
  args: {
    ...baseArgs,
    groups: DEEP_GROUPS,
    fields: DEEP_FIELDS,
    unassignedFields: [],
    selectedFieldId: null,
  },
}
