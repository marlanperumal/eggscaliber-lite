"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  rawToken: string
  onDismiss: () => void
}

export function TokenRevealCallout({ rawToken, onDismiss }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-[--warning] bg-[--warning-subtle] p-4 text-[--warning-foreground]"
    >
      <p className="font-medium text-sm">Copy your token now — it won&apos;t be shown again.</p>
      <div className="flex items-center gap-2">
        <code
          data-testid="raw-token"
          className="flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-foreground text-xs"
        >
          {rawToken}
        </code>
        <Button
          variant="outline"
          size="icon"
          aria-label={copied ? "Copied" : "Copy token"}
          onClick={handleCopy}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Done
      </Button>
    </div>
  )
}
