"use client"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RevokeConfirmDialog } from "./RevokeConfirmDialog"

interface Props {
  id: number
  name: string
  prefix: string
  createdAt: string
  lastUsedAt?: string | null
  onRevoke: (id: number) => Promise<void>
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function TokenListRow({ id, name, prefix, createdAt, lastUsedAt, onRevoke }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  const handleConfirm = async () => {
    setIsRevoking(true)
    await onRevoke(id)
    setIsRevoking(false)
    setDialogOpen(false)
  }

  return (
    <>
      <div
        data-testid="token-row"
        className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate font-medium text-foreground text-sm">{name}</p>
          <p className="font-mono text-muted-foreground text-xs">{prefix}…</p>
        </div>
        <div className="hidden shrink-0 text-right text-muted-foreground text-xs sm:block">
          <p>Created {relativeTime(createdAt)}</p>
          {lastUsedAt ? <p>Last used {relativeTime(lastUsedAt)}</p> : <p>Never used</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Revoke token ${name}`}
          onClick={() => setDialogOpen(true)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <RevokeConfirmDialog
        open={dialogOpen}
        tokenName={name}
        isLoading={isRevoking}
        onConfirm={handleConfirm}
        onCancel={() => setDialogOpen(false)}
      />
    </>
  )
}
