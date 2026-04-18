"use client"
import { useEffect, useRef } from "react"
import type { FieldNode, GroupNode } from "./FieldTree"

interface Props {
  fields: FieldNode[]
  groups: GroupNode[]
  onPick: (fieldId: number) => Promise<void>
  onClose: () => void
}

export function FieldPicker({ fields, groups, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  const grouped = groups.map((g) => ({
    group: g,
    fields: fields.filter((f) => f.upload_fieldgroup_id === g.id),
  }))
  const ungrouped = fields.filter((f) => f.upload_fieldgroup_id === null)

  return (
    <div
      ref={ref}
      className="absolute z-20 max-h-56 w-56 overflow-auto rounded border border-border bg-popover shadow-lg"
    >
      {grouped.map(({ group, fields: gf }) =>
        gf.length > 0 ? (
          <div key={group.id}>
            <div className="bg-muted/50 px-2 py-1 font-semibold text-muted-foreground text-xs">
              {group.name}
            </div>
            {gf.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={async () => {
                  await onPick(f.id)
                  onClose()
                }}
                className="block w-full px-3 py-1 text-left text-xs hover:bg-muted"
              >
                {f.display_name ?? f.field_key}
              </button>
            ))}
          </div>
        ) : null,
      )}
      {ungrouped.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={async () => {
            await onPick(f.id)
            onClose()
          }}
          className="block w-full px-3 py-1 text-left text-xs hover:bg-muted"
        >
          {f.display_name ?? f.field_key}
        </button>
      ))}
    </div>
  )
}
