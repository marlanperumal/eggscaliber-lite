"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  onGenerate: (name: string) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function GenerateTokenForm({ onGenerate, onCancel, isLoading = false }: Props) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Token name is required")
      return
    }
    setError(null)
    await onGenerate(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="token-name">Token name</Label>
        <Input
          id="token-name"
          placeholder="e.g. Claude Desktop"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          aria-describedby={error ? "token-name-error" : undefined}
        />
        {error && (
          <p id="token-name-error" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Generating…" : "Generate"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
