"use client"
import { useAuth } from "@clerk/nextjs"
import type { components } from "@shared/api"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { mutate } from "@/lib/mutate"
import { GenerateTokenForm } from "./GenerateTokenForm"
import { TokenListRow } from "./TokenListRow"
import { TokenRevealCallout } from "./TokenRevealCallout"

type ApiTokenRead = components["schemas"]["ApiTokenRead"]
type ApiTokenCreated = components["schemas"]["ApiTokenCreated"]

export function ApiTokensSection() {
  const { getToken } = useAuth()
  const [tokens, setTokens] = useState<ApiTokenRead[]>([])
  const [showForm, setShowForm] = useState(false)
  const [pendingToken, setPendingToken] = useState<ApiTokenCreated | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const authHeaders = useCallback(async () => {
    const token = await getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [getToken])

  const fetchTokens = useCallback(async () => {
    const headers = await authHeaders()
    const { data } = await api.GET("/api/v1/tokens", { headers })
    if (data) setTokens(data)
  }, [authHeaders])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  const handleGenerate = async (name: string) => {
    setIsGenerating(true)
    const headers = await authHeaders()
    const { data } = await mutate(() => api.POST("/api/v1/tokens", { body: { name }, headers }), {
      errorMessage: "Failed to generate token",
    })
    setIsGenerating(false)
    if (data) {
      setPendingToken(data)
      setShowForm(false)
      await fetchTokens()
    }
  }

  const handleRevoke = async (id: number) => {
    const headers = await authHeaders()
    await mutate(
      () =>
        api.DELETE("/api/v1/tokens/{token_id}", {
          params: { path: { token_id: id } },
          headers,
        }),
      { errorMessage: "Failed to revoke token" },
    )
    await fetchTokens()
  }

  return (
    <section className="space-y-4" aria-labelledby="api-tokens-heading">
      <div className="flex items-center justify-between">
        <h2 id="api-tokens-heading" className="font-semibold text-foreground text-lg">
          API Tokens
        </h2>
        {!showForm && !pendingToken && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            New Token
          </Button>
        )}
      </div>

      {pendingToken && (
        <TokenRevealCallout
          rawToken={pendingToken.raw_token}
          onDismiss={() => setPendingToken(null)}
        />
      )}

      {showForm && (
        <GenerateTokenForm
          onGenerate={handleGenerate}
          onCancel={() => setShowForm(false)}
          isLoading={isGenerating}
        />
      )}

      {tokens.length === 0 && !showForm && !pendingToken ? (
        <p className="text-muted-foreground text-sm">
          No active tokens. Generate one to connect Claude Desktop or Claude Code.
        </p>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <TokenListRow
              key={token.id}
              id={token.id}
              name={token.name}
              prefix={token.prefix}
              createdAt={token.created_at}
              lastUsedAt={token.last_used_at}
              onRevoke={handleRevoke}
            />
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
        <p className="font-medium text-foreground text-xs">Connect with Claude Code</p>
        <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-foreground text-xs">
          {`{
  "eggscaliber": {
    "type": "http",
    "url": "https://eggscaliber-lite-api.onrender.com/mcp/external",
    "headers": { "Authorization": "Bearer <your-token>" }
  }
}`}
        </pre>
      </div>
    </section>
  )
}
