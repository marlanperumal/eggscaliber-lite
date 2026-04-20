import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { FieldList } from "./FieldList"
import type { FieldNode, GroupNode } from "./FieldTree"

const meta = {
  title: "Datasets/Upload/FieldList",
  component: FieldList,
} satisfies Meta<typeof FieldList>
export default meta
type Story = StoryObj<typeof meta>

const GROUPS: GroupNode[] = [
  { id: 1, name: "Brand Tracker", parent_id: null, sort_order: 0 },
  { id: 2, name: "Demographics", parent_id: null, sort_order: 1 },
]

const FIELDS: FieldNode[] = [
  {
    id: 1,
    field_key: "brand_awareness",
    display_name: "Brand Awareness",
    detected_type: "categorical",
    override_type: null,
    sort_order: 0,
    upload_fieldgroup_id: 1,
    levels: [],
  },
  {
    id: 2,
    field_key: "gender",
    display_name: null,
    detected_type: "categorical",
    override_type: null,
    sort_order: 1,
    upload_fieldgroup_id: 2,
    levels: [],
  },
]

const UNASSIGNED: FieldNode[] = [
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

export const Default: Story = {
  args: {
    fields: FIELDS,
    groups: GROUPS,
    unassignedFields: UNASSIGNED,
    selectedFieldId: null,
    onSelectField: fn(),
    onMoveField: fn(),
  },
}

export const WithContextMenu: Story = {
  args: {
    fields: [
      {
        id: 1,
        field_key: "brand_awareness",
        display_name: "Brand Awareness",
        detected_type: "categorical",
        override_type: null,
        sort_order: 0,
        upload_fieldgroup_id: 1,
        levels: [],
      },
    ],
    groups: GROUPS,
    unassignedFields: UNASSIGNED,
    selectedFieldId: null,
    onSelectField: fn(),
    onMoveField: fn(),
  },
}
