# MCP Interface Gap-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four gaps identified in the MCP Interface audit (2026-04-22) against spec `docs/superpowers/specs/2026-04-22-mcp-interface-design.md`.

**Architecture:** Add one backend test file covering access-filter denial, extract a `TokenList` component, add a per-token `TokenConfigSnippets` component showing both Claude Code and Claude Desktop JSON, and verify a11y via Storybook build.

**Tech Stack:** FastAPI + SQLModel + pytest (backend) · Next.js App Router + React + shadcn/ui + Storybook (frontend)

---

## Gaps Addressed

| # | Gap | Task |
|---|---|---|
| 1 | No test proves `accessible_ids` filtering rejects an unentitled package | Task 1 |
| 2 | No dedicated `TokenList` component | Task 2 |
| 3 | Claude Desktop config snippet missing; snippets not per-token | Tasks 3–4 |
| 4 | Storybook a11y not verified | Task 5 |

---

## File Structure

**Backend (create):**
- `apps/api/tests/test_mcp_tools_access.py` — access-filter denial tests against service layer

**Frontend (create):**
- `apps/web/src/app/account/components/TokenList.tsx`
- `apps/web/src/app/account/components/TokenList.stories.tsx`
- `apps/web/src/app/account/components/TokenConfigSnippets.tsx`
- `apps/web/src/app/account/components/TokenConfigSnippets.stories.tsx`

**Frontend (modify):**
- `apps/web/src/app/account/components/ApiTokensSection.tsx` — replace inline list map with `<TokenList>`; remove the single static snippet block
- `apps/web/src/app/account/components/TokenListRow.tsx` — mount `<TokenConfigSnippets prefix={prefix} />` as collapsible detail
- `apps/web/src/app/account/components/TokenListRow.stories.tsx` — add story variant showing expanded snippets

---

## Task 1: Backend — Access Filter Denial Test

**Files:**
- Create: `apps/api/tests/test_mcp_tools_access.py`

**Rationale:** `test_mcp_tools.py` only exercises dev-mode where `_get_accessible_package_ids` returns `None` (all-access). Filter enforcement is untested. We test the service layer directly by passing an explicit restricted `accessible_ids` set — this bypasses the dev-mode short-circuit and exercises the actual filter path used by MCP tools.

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_mcp_tools_access.py`:

```python
"""Tests that MCP tool service calls enforce accessible_ids filtering.

We pass an explicit restricted accessible_ids set (as the middleware would in prod
mode) and assert that packages/collections/datasets outside the set are excluded.
This complements test_mcp_tools.py, which only covers the dev-mode all-access path.
"""

from typing import cast

from src.errors import PackageNotFoundError
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.group import PackageCollection
from src.models.package import Package
from src.services import dataset_service, package_service
import pytest


async def _make_pkg_with_dataset(db, *, pkg_name: str, pkg_slug: str) -> tuple[Package, Collection, Dataset]:
    pkg = Package(name=pkg_name, slug=pkg_slug)
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    col = Collection(name=f"{pkg_name} Col", slug=f"{pkg_slug}-col", collection_type=CollectionType.survey)
    db.add(col)
    await db.flush()
    await db.refresh(col)

    db.add(PackageCollection(package_id=cast(int, pkg.id), collection_id=cast(int, col.id)))
    await db.flush()

    ds = Dataset(name=f"{pkg_name} DS", slug=f"{pkg_slug}-ds", collection_id=col.id, sort_order=0)
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    return pkg, col, ds


async def test_list_packages_excludes_unentitled_packages(db):
    entitled, _, _ = await _make_pkg_with_dataset(db, pkg_name="Entitled", pkg_slug="entitled-pkg")
    forbidden, _, _ = await _make_pkg_with_dataset(db, pkg_name="Forbidden", pkg_slug="forbidden-pkg")

    accessible_ids = {cast(int, entitled.id)}
    result = await package_service.list_packages(db, accessible_ids)

    names = [p.name for p in result]
    assert "Entitled" in names
    assert "Forbidden" not in names


async def test_list_datasets_rejects_collection_in_unentitled_package(db):
    _, _, _ = await _make_pkg_with_dataset(db, pkg_name="Entitled", pkg_slug="entitled-pkg-2")
    forbidden_pkg, forbidden_col, _ = await _make_pkg_with_dataset(
        db, pkg_name="Forbidden", pkg_slug="forbidden-pkg-2"
    )

    # User only entitled to the "Entitled" package, NOT forbidden_pkg
    entitled_pkg_ids = {
        pid for pid in (await package_service.list_packages(db, None))
        if pid.slug == "entitled-pkg-2"
    }
    accessible_ids = {cast(int, p.id) for p in entitled_pkg_ids}

    with pytest.raises(PackageNotFoundError):
        await dataset_service.list_datasets(
            db,
            collection_id=cast(int, forbidden_col.id),
            accessible_ids=accessible_ids,
        )


async def test_describe_dataset_rejects_unentitled_dataset(db):
    entitled, _, _ = await _make_pkg_with_dataset(db, pkg_name="Entitled", pkg_slug="entitled-pkg-3")
    _, _, forbidden_ds = await _make_pkg_with_dataset(
        db, pkg_name="Forbidden", pkg_slug="forbidden-pkg-3"
    )

    accessible_ids = {cast(int, entitled.id)}

    with pytest.raises(PackageNotFoundError):
        await dataset_service.get_with_fields(db, cast(int, forbidden_ds.id), accessible_ids)
```

- [ ] **Step 2: Verify the PackageNotFoundError import and dataset_service raise behavior**

Before running, confirm:

```bash
grep -n "PackageNotFoundError\|NotFoundError\|accessible_ids" apps/api/src/services/dataset_service.py | head -20
```

If `dataset_service` raises a different exception when `accessible_ids` excludes the dataset's package (e.g. `NotFoundError`, `ForbiddenError`), **update the two `pytest.raises(...)` lines and the import to match**. Do not proceed until you've confirmed the real exception type by reading `apps/api/src/services/dataset_service.py` and `apps/api/src/errors.py`.

- [ ] **Step 3: Run tests — expect fail (or error) on first attempt**

Run: `just test-api tests/test_mcp_tools_access.py -v`

Expected: One or more failures if the exception type is wrong, or PASS if guessed right.

- [ ] **Step 4: Fix the exception type if needed based on real code**

Update imports and `pytest.raises` to the actual exception the service raises. Re-run.

- [ ] **Step 5: Run test to verify it passes**

Run: `just test-api tests/test_mcp_tools_access.py -v`

Expected: 3 passed.

- [ ] **Step 6: Run full backend test suite to confirm no regressions**

Run: `just test-api`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/tests/test_mcp_tools_access.py
```

Write message to `/tmp/commit-msg.txt`:

```
test(api): add access-filter denial tests for MCP tool services

Covers spec requirement: "a user in group A cannot retrieve packages
outside their entitlement". Existing test_mcp_tools.py only exercises
the dev-mode all-access path where accessible_ids is None.
```

Then: `git commit -F /tmp/commit-msg.txt`

---

## Task 2: Frontend — Extract `TokenList` Component

**Files:**
- Create: `apps/web/src/app/account/components/TokenList.tsx`
- Create: `apps/web/src/app/account/components/TokenList.stories.tsx`
- Modify: `apps/web/src/app/account/components/ApiTokensSection.tsx`

- [ ] **Step 1: Create `TokenList.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `TokenList.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { TokenList } from "./TokenList"

const meta: Meta<typeof TokenList> = {
  title: "Account/TokenList",
  component: TokenList,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: { onRevoke: async () => {} },
}
export default meta
type Story = StoryObj<typeof TokenList>

const now = Date.now()
const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString()

export const Empty: Story = { args: { tokens: [] } }

export const OneToken: Story = {
  args: {
    tokens: [
      {
        id: 1,
        name: "Claude Desktop",
        prefix: "eggsec_1a2b3c4",
        created_at: iso(3),
        last_used_at: iso(0.02),
      },
    ],
  },
}

export const MultipleTokens: Story = {
  args: {
    tokens: [
      {
        id: 1,
        name: "Claude Desktop",
        prefix: "eggsec_1a2b3c4",
        created_at: iso(3),
        last_used_at: iso(0.02),
      },
      {
        id: 2,
        name: "Claude Code (laptop)",
        prefix: "eggsec_9z8y7x6",
        created_at: iso(14),
        last_used_at: null,
      },
    ],
  },
}
```

- [ ] **Step 3: Modify `ApiTokensSection.tsx` to use `TokenList`**

Replace the current rendering block (currently lines ~92-110 and the static snippet block ~112-123) so the section becomes:

```tsx
"use client"
import { useAuth } from "@clerk/nextjs"
import type { components } from "@shared/api"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { mutate } from "@/lib/mutate"
import { GenerateTokenForm } from "./GenerateTokenForm"
import { TokenList } from "./TokenList"
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

      {!showForm && !pendingToken && <TokenList tokens={tokens} onRevoke={handleRevoke} />}
    </section>
  )
}
```

Note the static bottom-of-section config snippet block is **removed** — snippets are moving per-token in Task 3.

- [ ] **Step 4: Verify Storybook builds without errors**

Run: `just build-storybook`

Expected: build succeeds, new `Account/TokenList` entries appear in the output log.

- [ ] **Step 5: Typecheck + lint**

Run: `just typecheck && just lint`

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/account/components/TokenList.tsx \
        apps/web/src/app/account/components/TokenList.stories.tsx \
        apps/web/src/app/account/components/ApiTokensSection.tsx
```

`/tmp/commit-msg.txt`:

```
refactor(web): extract TokenList component from ApiTokensSection

Matches the component list in the MCP interface spec. Removes the
static bottom-of-section config snippet block in preparation for
per-token snippets (next commit).
```

Then: `git commit -F /tmp/commit-msg.txt`

---

## Task 3: Frontend — `TokenConfigSnippets` Component

**Files:**
- Create: `apps/web/src/app/account/components/TokenConfigSnippets.tsx`
- Create: `apps/web/src/app/account/components/TokenConfigSnippets.stories.tsx`

**Rationale:** Spec requires both Claude Code AND Claude Desktop JSON snippets, shown "alongside each token's prefix". Raw token is only available at creation time, so snippets use `<your-token>` placeholder plus display the prefix for recognition.

- [ ] **Step 1: Create `TokenConfigSnippets.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `TokenConfigSnippets.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { TokenConfigSnippets } from "./TokenConfigSnippets"

const meta: Meta<typeof TokenConfigSnippets> = {
  title: "Account/TokenConfigSnippets",
  component: TokenConfigSnippets,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: { prefix: "eggsec_1a2b3c4" },
}
export default meta
type Story = StoryObj<typeof TokenConfigSnippets>

export const Default: Story = {}
```

- [ ] **Step 3: Verify Storybook builds**

Run: `just build-storybook`

Expected: build succeeds.

- [ ] **Step 4: Typecheck + lint**

Run: `just typecheck && just lint`

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/account/components/TokenConfigSnippets.tsx \
        apps/web/src/app/account/components/TokenConfigSnippets.stories.tsx
```

`/tmp/commit-msg.txt`:

```
feat(web): add TokenConfigSnippets with Claude Code and Claude Desktop JSON

Fills the spec requirement for both snippets "alongside each token's
prefix" on /account. Each snippet has its own copy-to-clipboard button.
```

Then: `git commit -F /tmp/commit-msg.txt`

---

## Task 4: Frontend — Wire Snippets into `TokenListRow`

**Files:**
- Modify: `apps/web/src/app/account/components/TokenListRow.tsx`
- Modify: `apps/web/src/app/account/components/TokenListRow.stories.tsx`

- [ ] **Step 1: Update `TokenListRow.tsx` to include expandable config snippets**

Replace the file contents:

```tsx
"use client"
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RevokeConfirmDialog } from "./RevokeConfirmDialog"
import { TokenConfigSnippets } from "./TokenConfigSnippets"

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
  const [configOpen, setConfigOpen] = useState(false)

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
        className="space-y-3 rounded-lg border border-border px-4 py-3"
      >
        <div className="flex items-center justify-between gap-4">
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
            size="sm"
            aria-expanded={configOpen}
            aria-controls={`token-config-${id}`}
            onClick={() => setConfigOpen((v) => !v)}
          >
            {configOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="ml-1 text-xs">Config</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Revoke token ${name}`}
            onClick={() => setDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        {configOpen && (
          <div id={`token-config-${id}`}>
            <TokenConfigSnippets prefix={prefix} />
          </div>
        )}
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
```

- [ ] **Step 2: Add expanded-snippets story variant**

Update `TokenListRow.stories.tsx` by appending (keep existing `NeverUsed` and `WithLastUsed`):

```tsx
export const WithConfigOpen: Story = {
  args: { lastUsedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  play: async ({ canvas, userEvent }) => {
    const configBtn = await canvas.findByRole("button", { name: /config/i })
    await userEvent.click(configBtn)
  },
}
```

If the existing stories file doesn't import `userEvent` / `canvas` args, add `play` imports per the Storybook 8+ CSF3 pattern — otherwise just leave it as a static variant:

```tsx
export const WithConfigOpen: Story = {
  args: { lastUsedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
}
```

(Manual expansion via the toggle button in the Storybook UI is acceptable.)

- [ ] **Step 3: Run Storybook build**

Run: `just build-storybook`

Expected: build succeeds.

- [ ] **Step 4: Typecheck + lint**

Run: `just typecheck && just lint`

Expected: both pass.

- [ ] **Step 5: Run web tests**

Run: `just test-web`

Expected: no regressions.

- [ ] **Step 6: Smoke test in dev server**

Start `just dev`, navigate to `http://localhost:3000/account`, and verify:
1. "Config" toggle expands to show both Claude Code and Claude Desktop snippets
2. Both copy buttons work (click, see check icon)
3. Revoke button still works

Use `agent-browser` if needed:

```bash
agent-browser open http://localhost:3000/account
agent-browser snapshot -i
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/account/components/TokenListRow.tsx \
        apps/web/src/app/account/components/TokenListRow.stories.tsx
```

`/tmp/commit-msg.txt`:

```
feat(web): per-token expandable config snippets in TokenListRow

Replaces the single section-level Claude Code snippet with per-token
Claude Code + Claude Desktop snippets, matching the MCP interface spec.
Each row now has a collapsible Config area.
```

Then: `git commit -F /tmp/commit-msg.txt`

---

## Task 5: Storybook a11y Verification

- [ ] **Step 1: Run Storybook a11y checks**

Run: `just build-storybook`

Expected: zero a11y violations reported for `Account/TokenList`, `Account/TokenListRow`, `Account/TokenConfigSnippets`, `Account/ApiTokensSection`, `Account/GenerateTokenForm`, `Account/RevokeConfirmDialog`, `Account/TokenRevealCallout`.

- [ ] **Step 2: If violations appear, fix them inline**

Common issues and fixes:
- Missing `aria-label` on icon-only buttons → add the label
- Low contrast text → use design tokens (never raw hex)
- Missing `aria-controls`/`aria-expanded` on toggle → already added in Task 4
- Dialog without `aria-describedby` → shadcn `AlertDialog` handles this; verify the `Description` is present

Re-run `just build-storybook` after each fix.

- [ ] **Step 3: Run full pre-push suite**

Run:

```bash
just lint && just format-check && just typecheck && just build-storybook && just test
```

Expected: all green.

- [ ] **Step 4: Final commit (only if any fixes were made in Step 2)**

```bash
git add apps/web/src/app/account/components/
```

`/tmp/commit-msg.txt`:

```
fix(web): resolve a11y violations in API token components

Fixes found during Storybook a11y verification as part of the MCP
interface gap-fill.
```

Then: `git commit -F /tmp/commit-msg.txt`

If no fixes needed, skip this step.

---

## Self-Review

**Spec coverage:** Each of the 4 identified gaps maps to a task above. No other spec items were flagged.

**Placeholder scan:** All code steps include actual code. No TBDs.

**Type consistency:** `TokenList` uses the generated `ApiTokenRead` type. `TokenConfigSnippets` takes a single `prefix: string` prop consistent with `TokenListRow`'s `prefix` field.

**Patterns compliance:**
- No `as any` casts — all types use `components["schemas"][...]` from `@shared/api`
- No raw hex colors — uses `text-foreground`, `text-muted-foreground`, `bg-muted`, `border-border`, `text-destructive`
- No `dark:` overrides
- Backend: new test file only — no route/service/repo changes, so route/service typing rules don't apply

**Risk notes:**
- Task 1 Step 2 explicitly flags that the exception type in the access-filter tests must be confirmed against the real `dataset_service.py` code before running — don't trust the `PackageNotFoundError` guess blindly.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-22-mcp-interface-gap-fill.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks.

**2. Inline Execution** — Execute tasks in this session with checkpoints for review.

Which approach?
