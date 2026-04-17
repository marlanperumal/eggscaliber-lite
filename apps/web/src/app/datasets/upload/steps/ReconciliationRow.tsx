import { cn } from "@/lib/utils"

export type ReconGroup = "exact" | "probable" | "new_only" | "old_only"
export type ReconStatus = "auto_accepted" | "pending" | "confirmed" | "rejected" | "excluded"

export interface ReconRow {
  id: number
  group: ReconGroup
  status: ReconStatus
  upload_field_id: number | null
  ref_field_id: number | null
  confidence: number | null
  note: string | null
  // Enriched on the frontend after fetching field keys
  field_key?: string
  ref_field_key?: string
  field_type?: string
}

const GROUP_DOT: Record<ReconGroup, string> = {
  exact: "bg-green-500",
  probable: "bg-amber-500",
  new_only: "bg-blue-500",
  old_only: "bg-muted-foreground",
}

const STATUS_CHIP: Record<ReconStatus, string> = {
  auto_accepted: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  rejected: "bg-muted text-muted-foreground",
  excluded: "bg-muted text-muted-foreground",
}

interface Props {
  row: ReconRow
  checked: boolean
  onCheck: (id: number, checked: boolean) => void
  onAction: (id: number, action: "confirm" | "reject" | "exclude" | "map") => void
}

export function ReconciliationRow({ row, checked, onCheck, onAction }: Props) {
  return (
    <div
      className="grid items-center gap-2 border-border border-b px-3 py-2 text-xs last:border-0"
      style={{ gridTemplateColumns: "20px 10px 1fr 1fr 1fr 80px 80px auto" }}
      data-testid="recon-row"
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheck(row.id, e.target.checked)}
        aria-label={`Select row ${row.id}`}
      />
      {/* Status dot */}
      <span className={cn("h-2 w-2 rounded-full", GROUP_DOT[row.group])} aria-hidden="true" />
      {/* field_key */}
      <span className="truncate font-mono">{row.field_key ?? `field_${row.upload_field_id}`}</span>
      {/* match_target */}
      <span className="truncate text-muted-foreground">
        {row.ref_field_key ?? (row.group === "new_only" || row.group === "old_only" ? "—" : "?")}
      </span>
      {/* note */}
      <span className="truncate text-muted-foreground">{row.note ?? ""}</span>
      {/* type */}
      <span className="truncate">{row.field_type ?? ""}</span>
      {/* status chip */}
      <span className={cn("rounded-full px-2 py-0.5 font-semibold", STATUS_CHIP[row.status])}>
        {row.status.replace("_", " ")}
      </span>
      {/* actions */}
      <div className="flex gap-1">
        {row.group === "probable" && row.status === "pending" && (
          <>
            <button
              type="button"
              onClick={() => onAction(row.id, "confirm")}
              className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800 text-xs hover:bg-green-200"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => onAction(row.id, "reject")}
              className="rounded bg-muted px-1.5 py-0.5 font-semibold text-xs hover:bg-muted/60"
            >
              Reject
            </button>
          </>
        )}
        {row.group === "old_only" && row.status === "pending" && (
          <button
            type="button"
            onClick={() => onAction(row.id, "exclude")}
            className="rounded bg-muted px-1.5 py-0.5 font-semibold text-xs hover:bg-muted/60"
          >
            Exclude
          </button>
        )}
      </div>
    </div>
  )
}
