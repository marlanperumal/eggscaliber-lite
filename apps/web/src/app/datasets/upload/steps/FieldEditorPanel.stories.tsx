import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { FieldEditorPanel } from "./FieldEditorPanel"
import type { FieldNode, GroupNode } from "./FieldTree"

const meta: Meta<typeof FieldEditorPanel> = {
  title: "Datasets/Upload/FieldEditorPanel",
  component: FieldEditorPanel,
}
export default meta
type Story = StoryObj<typeof FieldEditorPanel>

const GROUPS: GroupNode[] = [
  { id: 1, name: "Brand Tracker", parent_id: null, sort_order: 0 },
  { id: 2, name: "Demographics", parent_id: null, sort_order: 1 },
]

const FIELD: FieldNode = {
  id: 1,
  field_key: "brand_awareness",
  display_name: "Brand Awareness",
  detected_type: "categorical",
  override_type: null,
  sort_order: 1,
  upload_fieldgroup_id: 1,
  levels: [],
}

export const NoSelection: Story = {
  args: {
    sessionId: 1,
    field: null,
    groups: GROUPS,
    onSaved: fn(),
    onCancel: fn(),
    onDelete: fn(),
    onCreateGroup: fn(),
  },
}

export const FieldSelected: Story = {
  args: {
    sessionId: 1,
    field: FIELD,
    groups: GROUPS,
    onSaved: fn(),
    onCancel: fn(),
    onDelete: fn(),
    onCreateGroup: fn(),
  },
}

export const WithLevels: Story = {
  args: {
    sessionId: 1,
    field: {
      id: 10,
      field_key: "gender",
      display_name: "Gender",
      detected_type: "categorical",
      override_type: null,
      sort_order: 2,
      upload_fieldgroup_id: null,
      levels: [
        { id: 1, raw_value: "M", display_label: "Male", sort_order: 0, is_inherited: false },
        { id: 2, raw_value: "F", display_label: "Female", sort_order: 1, is_inherited: false },
      ],
    },
    groups: [],
    onSaved: fn(),
    onCancel: fn(),
    onDelete: fn(),
    onCreateGroup: fn(),
  },
}
