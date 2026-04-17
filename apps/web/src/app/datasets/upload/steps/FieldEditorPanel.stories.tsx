import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn, spyOn } from "@storybook/test"
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
  upload_fieldgroup_id: 1,
}

export const NoSelection: Story = {
  args: { sessionId: 1, field: null, groups: GROUPS, onSaved: fn() },
}

export const FieldSelected: Story = {
  args: { sessionId: 1, field: FIELD, groups: GROUPS, onSaved: fn() },
  beforeEach() {
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ...FIELD }), { status: 200 }),
    )
  },
}
