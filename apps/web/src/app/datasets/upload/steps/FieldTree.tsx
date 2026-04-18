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
import { useEffect, useRef, useState } from "react"

export interface Level {
  id: number
  raw_value: string
  display_label: string | null
  sort_order: number
  is_inherited: boolean
}

export interface FieldNode {
  id: number
  field_key: string
  display_name: string | null
  detected_type: string
  override_type: string | null
  sort_order: number
  upload_fieldgroup_id: number | null
  levels: Level[]
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
  onMoveGroup?: (groupId: number, parentId: number | null) => void
}

function GroupContextMenu({
  groupId,
  groupName,
  allGroups,
  onRename,
  onDelete,
  onAddSubgroup,
  onMoveGroup,
  onClose,
}: {
  groupId: number
  groupName: string
  allGroups: GroupNode[]
  onRename: (id: number, name: string) => void
  onDelete: (id: number) => void
  onAddSubgroup: () => void
  onMoveGroup?: (groupId: number, parentId: number | null) => void
  onClose: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [showMove, setShowMove] = useState(false)
  const [nameValue, setNameValue] = useState(groupName)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (renaming) inputRef.current?.focus()
  }, [renaming])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [onClose])

  const moveTargets = allGroups.filter((g) => g.id !== groupId)

  if (renaming) {
    return (
      <div
        ref={menuRef}
        className="absolute top-6 right-0 z-50 flex items-center gap-1 rounded-lg border border-border bg-background p-1 shadow-lg"
      >
        <input
          ref={inputRef}
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRename(groupId, nameValue)
              onClose()
            }
            if (e.key === "Escape") onClose()
          }}
          className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Rename group"
        />
        <button
          type="button"
          onClick={() => {
            onRename(groupId, nameValue)
            onClose()
          }}
          className="rounded bg-accent px-2 py-1 text-white text-xs"
        >
          OK
        </button>
      </div>
    )
  }

  if (showMove) {
    return (
      <div
        ref={menuRef}
        className="absolute top-6 right-0 z-50 min-w-36 rounded-lg border border-border bg-background py-1 shadow-lg"
      >
        <p className="px-3 py-1 font-semibold text-muted-foreground text-xs">Move to…</p>
        <button
          type="button"
          onClick={() => {
            onMoveGroup?.(groupId, null)
            onClose()
          }}
          className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-muted"
        >
          Top level
        </button>
        {moveTargets.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              onMoveGroup?.(groupId, g.id)
              onClose()
            }}
            className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-muted"
          >
            {g.name}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={menuRef}
      className="absolute top-6 right-0 z-50 min-w-32 rounded-lg border border-border bg-background py-1 shadow-lg"
    >
      <button
        type="button"
        onClick={() => {
          onAddSubgroup()
          onClose()
        }}
        className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-muted"
      >
        Add subgroup
      </button>
      {onMoveGroup && (
        <button
          type="button"
          onClick={() => setShowMove(true)}
          className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-muted"
        >
          Move to…
        </button>
      )}
      <button
        type="button"
        onClick={() => setRenaming(true)}
        className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-muted"
      >
        Rename
      </button>
      <button
        type="button"
        onClick={() => {
          onDelete(groupId)
          onClose()
        }}
        className="flex w-full items-center px-3 py-1.5 text-destructive text-xs hover:bg-muted"
      >
        Delete
      </button>
    </div>
  )
}

export function FieldTree({
  groups,
  fields,
  unassignedFields,
  selectedFieldId,
  onSelectField,
  onMoveField,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onMoveGroup,
}: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
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
          className="relative flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs hover:bg-muted"
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
            onClick={() => setOpenMenuId(openMenuId === group.id ? null : group.id)}
            className="text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal size={11} />
          </button>
          {openMenuId === group.id && (
            <GroupContextMenu
              groupId={group.id}
              groupName={group.name}
              allGroups={groups}
              onRename={(id, name) => onRenameGroup?.(id, name)}
              onDelete={onDeleteGroup}
              onAddSubgroup={() => onCreateGroup("New subgroup", group.id)}
              onMoveGroup={onMoveGroup}
              onClose={() => setOpenMenuId(null)}
            />
          )}
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
