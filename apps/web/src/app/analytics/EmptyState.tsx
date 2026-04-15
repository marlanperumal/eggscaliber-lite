interface EmptyStateProps {
  illustration: React.ReactNode
  title: string
  body: string
}

export function EmptyState({ illustration, title, body }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex items-center justify-center">{illustration}</div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-[160px] text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
