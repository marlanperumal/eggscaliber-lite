"use client"

interface Props {
  groupId: number | null
}

export function PackagesPanel({ groupId }: Props) {
  if (!groupId) {
    return (
      <div
        data-testid="packages-panel"
        className="flex items-center justify-center rounded-lg border border-border bg-card"
      >
        <p className="text-muted-foreground text-sm opacity-60">Select a group to view packages</p>
      </div>
    )
  }

  return (
    <div
      data-testid="packages-panel"
      className="flex flex-col rounded-lg border border-border bg-card"
    >
      <div className="border-border border-b px-4 py-3">
        <span className="font-semibold text-foreground text-sm">Packages</span>
      </div>
      <div className="flex-1 p-4">
        <p className="text-muted-foreground text-sm">Group {groupId} packages</p>
      </div>
    </div>
  )
}
