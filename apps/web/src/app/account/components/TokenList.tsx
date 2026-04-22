"use client"
import type { components } from "@shared/api"
import { TokenListRow } from "./TokenListRow"

type ApiTokenRead = components["schemas"]["ApiTokenRead"]

interface Props {
  tokens: ApiTokenRead[]
  onRevoke: (id: number) => Promise<void>
}

export function TokenList({ tokens, onRevoke }: Props) {
  if (tokens.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No active tokens. Generate one to connect Claude Desktop or Claude Code.
      </p>
    )
  }

  return (
    <div className="space-y-2" data-testid="token-list">
      {tokens.map((token) => (
        <TokenListRow
          key={token.id}
          id={token.id}
          name={token.name}
          prefix={token.prefix}
          createdAt={token.created_at}
          lastUsedAt={token.last_used_at}
          onRevoke={onRevoke}
        />
      ))}
    </div>
  )
}
