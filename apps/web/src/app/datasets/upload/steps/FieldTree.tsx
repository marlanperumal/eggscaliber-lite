"use client"
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Plus } from "lucide-react"
import { useState } from "react"

export interface FieldNode {
  id: number
  field_key: string
  display_name: string | null
  detected_type: string
  override_type: string | null
  upload_fieldgroup_id: number | null
}
export interface GroupNode {
  id: number
  name: string
  parent_id: number | null
  sort_order: number
}

interface Props {
  groups: GroupNode[]
  fields: FieldNode[]
  unassignedFields: FieldNode[]
  selectedFieldId: number | null
  onSelectField: (id: number) => void
  onMoveField: (fieldId: number, groupId: number | null) => void
  onCreateGroup: (name: string, parentId: number | null) => void
  onRenameGroup?: (id: number, name: string) => void
  onDeleteGroup: (id: number) => void
}

export function FieldTree({
  groups,
  fields,
  unassignedFields,
  selectedFieldId,
  onSelectField,
  onMoveField,
  onCreateGroup,
  onRenameGroup: _onRenameGroup,
  onDeleteGroup,
}: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const activeStr = String(active.id)
    const overStr = String(over.id)
    if (activeStr.startsWith("field-")) {
      const fieldId = Number(activeStr.replace("field-", ""))
      const groupId = overStr.startsWith("group-") ? Number(overStr.replace("group-", "")) : null
      onMoveField(fieldId, groupId)
    }
  }

  const rootGroups = groups.filter((g) => g.parent_id === null)

  function renderGroup(group: GroupNode, depth = 0) {
    const groupFields = fields.filter((f) => f.upload_fieldgroup_id === group.id)
    const childGroups = groups.filter((g) => g.parent_id === group.id)
    const isExpanded = expanded.has(group.id)

    return (
      <GroupDropZone key={group.id} groupId={group.id}>
        <div
          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs hover:bg-muted"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <button
            type="button"
            onClick={() => toggleExpand(group.id)}
            aria-expanded={isExpanded}
            aria-label={`Toggle ${group.name}`}
            className="flex flex-1 items-center gap-1 text-left"
          >
            <span className="text-muted-foreground" aria-hidden="true">
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
            <span className="flex-1 font-semibold text-foreground">{group.name}</span>
          </button>
          <button
            type="button"
            aria-label={`Add subgroup to ${group.name}`}
            onClick={() => onCreateGroup("New subgroup", group.id)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus size={11} />
          </button>
          <button
            type="button"
            aria-label={`Group options for ${group.name}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal size={11} />
          </button>
        </div>

        {isExpanded && (
          <div>
            {childGroups.map((cg) => renderGroup(cg, depth + 1))}
            {groupFields.map((f) => (
              <FieldLeaf
                key={f.id}
                field={f}
                selected={selectedFieldId === f.id}
                onSelect={onSelectField}
              />
            ))}
          </div>
        )}
      </GroupDropZone>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex flex-col gap-0.5 overflow-auto">
        <button
          type="button"
          onClick={() => onCreateGroup("New group", null)}
          className="mb-1 flex items-center gap-1 rounded px-2 py-1 font-semibold text-accent text-xs hover:bg-muted"
        >
          <Plus size={11} aria-hidden="true" /> New group
        </button>
        {rootGroups.map((g) => renderGroup(g))}
        {/* Unassigned */}
        <div className="mt-2 border-border border-t pt-2">
          <p className="mb-1 px-2 font-semibold text-muted-foreground text-xs">Unassigned</p>
          {unassignedFields.map((f) => (
            <FieldLeaf
              key={f.id}
              field={f}
              selected={selectedFieldId === f.id}
              onSelect={onSelectField}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeId?.startsWith("field-") && (
          <div className="rounded border border-accent bg-background px-2 py-1 text-xs shadow">
            Moving field…
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function GroupDropZone({ groupId, children }: { groupId: number; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `group-${groupId}` })
  return <div ref={setNodeRef}>{children}</div>
}

function FieldLeaf({
  field,
  selected,
  onSelect,
}: {
  field: FieldNode
  selected: boolean
  onSelect: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-${field.id}`,
    data: { type: "field", fieldId: field.id, groupId: field.upload_fieldgroup_id },
  })
  const style = { transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.4 : 1 }

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(field.id)}
      className={[
        "flex w-full cursor-pointer items-center gap-1 rounded px-3 py-1 text-xs",
        selected ? "bg-accent/10 font-semibold text-accent" : "text-foreground hover:bg-muted",
      ].join(" ")}
      data-testid="field-leaf"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground"
        aria-hidden="true"
      >
        <GripVertical size={11} />
      </span>
      <span className="flex-1 truncate font-mono">{field.display_name ?? field.field_key}</span>
      <span className="text-muted-foreground">{field.override_type ?? field.detected_type}</span>
    </button>
  )
}
