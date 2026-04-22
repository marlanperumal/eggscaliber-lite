"use client"
import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

const API_URL = "https://eggscaliber-lite-api.onrender.com/mcp/external"

interface Props {
  prefix: string
}

const claudeCodeConfig = () =>
  JSON.stringify(
    {
      eggscaliber: {
        type: "http",
        url: API_URL,
        headers: { Authorization: "Bearer <your-token>" },
      },
    },
    null,
    2,
  )

const claudeDesktopConfig = () =>
  JSON.stringify(
    {
      mcpServers: {
        eggscaliber: {
          type: "http",
          url: API_URL,
          headers: { Authorization: "Bearer <your-token>" },
        },
      },
    },
    null,
    2,
  )

function Snippet({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="font-medium text-foreground text-xs">{label}</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label={copied ? `Copied ${label} config` : `Copy ${label} config`}
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-foreground text-xs">
        {code}
      </pre>
    </div>
  )
}

export function TokenConfigSnippets({ prefix }: Props) {
  return (
    <div
      data-testid="token-config-snippets"
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
    >
      <p className="text-muted-foreground text-xs">
        Config for token <span className="font-mono">{prefix}…</span> — replace{" "}
        <span className="font-mono">&lt;your-token&gt;</span> with the raw token shown at creation.
      </p>
      <Snippet label="Claude Code (.mcp.json)" code={claudeCodeConfig()} />
      <Snippet label="Claude Desktop (claude_desktop_config.json)" code={claudeDesktopConfig()} />
    </div>
  )
}
