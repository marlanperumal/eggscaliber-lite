# UX Polish — Iteration 1: App Shell & Panel Chrome — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Additional skills for executing agents:**
> - For tasks that create or significantly restyle UI components (Tasks 1, 3, 4): invoke **frontend-design:frontend-design** before writing component code — it governs production-grade UI quality, token usage, and accessibility standards for this codebase.

**Goal:** Add a branded top navigation bar to the root layout and restyle the analytics panels as raised cards floating on a muted workspace background.

**Architecture:** One new `TopNav` client component wired into `app/layout.tsx`. `AnalyticsLayout` is updated in-place to use card chrome (panel wrappers + muted workspace bg). Panel header strips in `FieldTreePanel`, `QueryBuilderPanel`, and `ResultsPanel` each gain a `bg-muted/50` tint.

**Tech Stack:** Next.js App Router, Tailwind v4, shadcn/ui (`Avatar`, `DropdownMenu`, `Button`), react-resizable-panels, `@storybook/nextjs-vite` for the story.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/web/src/components/ui/top-nav.tsx` | Create | Branded nav bar — logo, links, theme toggle, avatar |
| `apps/web/src/components/ui/top-nav.stories.tsx` | Create | Storybook story with a11y |
| `apps/web/src/app/layout.tsx` | Modify | Add TopNav; wrap children in flex shell |
| `apps/web/src/app/analytics/AnalyticsLayout.tsx` | Modify | Remove inline header; add card wrappers + muted workspace |
| `apps/web/src/app/analytics/FieldTreePanel.tsx` | Modify | Remove outer border-r; add bg-muted/50 to header |
| `apps/web/src/app/analytics/QueryBuilderPanel.tsx` | Modify | Remove outer border-r; add bg-muted/50 to header |
| `apps/web/src/app/analytics/ResultsPanel.tsx` | Modify | Add bg-muted/50 to header |

---

## Task 1: TopNav component

**Files:**
- Create: `apps/web/src/components/ui/top-nav.tsx`
- Create: `apps/web/src/components/ui/top-nav.stories.tsx`

No unit tests for this task — it is purely presentational with no business logic. Correctness is verified visually + via Storybook a11y.

- [ ] **Step 1: Create the TopNav component**

Create `apps/web/src/components/ui/top-nav.tsx` with this exact content:

```tsx
"use client"

import { Moon, Sun } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { themeConfig } from "@/config/theme.config"

const NAV_LINKS = [{ href: "/analytics", label: "Analytics" }]

export function TopNav() {
  const pathname = usePathname()
  const { setTheme } = useTheme()

  return (
    <nav className="flex h-12 shrink-0 items-center gap-4 bg-nav px-4 text-primary-foreground">
      <span className="text-sm font-bold tracking-tight">{themeConfig.brand.name}</span>
      <div className="flex gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/15 text-primary-foreground"
                  : "text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground"
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle colour scheme"
              className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-white/20 text-[10px] font-bold text-primary-foreground">
            MP
          </AvatarFallback>
        </Avatar>
      </div>
    </nav>
  )
}
```

**Why the theme toggle is inlined here (not using `ThemeToggle`):** The existing `ThemeToggle` uses `variant="ghost"` which hovers to `bg-accent` — a very light teal on the dark `--nav` background. Inlining the dropdown with `hover:bg-white/15` keeps the hover readable on the nav.

- [ ] **Step 2: Create the Storybook story**

Create `apps/web/src/components/ui/top-nav.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { TopNav } from "./top-nav"

const meta = {
  component: TopNav,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      navigation: {
        pathname: "/analytics",
      },
    },
  },
} satisfies Meta<typeof TopNav>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
```

- [ ] **Step 3: Run Storybook and verify**

```bash
just storybook
```

Open http://localhost:6006, navigate to **UI / TopNav / Default**. Check:
- Logo text renders in nav bar
- "Analytics" link is highlighted (active state)
- Theme toggle icon visible
- Avatar initials "MP" visible
- Switch to dark theme in Storybook toolbar — nav should remain dark/readable
- Accessibility panel shows no violations

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/top-nav.tsx apps/web/src/components/ui/top-nav.stories.tsx
git commit -F /tmp/commit-msg.txt
```

Write `/tmp/commit-msg.txt` first:
```
feat(web): add TopNav component with branded nav, theme toggle, avatar placeholder

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Task 2: Root layout shell

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Update layout.tsx**

Current `<body>` and children:
```tsx
<body className={inter.className}>
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
  >
    <NuqsAdapter>
      <PostHogProvider
        clientOptions={{ api_host: "/ingest", debug: process.env.NODE_ENV === "development" }}
      >
        <PostHogPageView />
        {children}
      </PostHogProvider>
    </NuqsAdapter>
  </ThemeProvider>
</body>
```

Replace with:
```tsx
<body className={`${inter.className} flex min-h-screen flex-col`}>
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
  >
    <NuqsAdapter>
      <PostHogProvider
        clientOptions={{ api_host: "/ingest", debug: process.env.NODE_ENV === "development" }}
      >
        <PostHogPageView />
        <TopNav />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </PostHogProvider>
    </NuqsAdapter>
  </ThemeProvider>
</body>
```

Also add the import at the top of the file (after the existing imports):
```tsx
import { TopNav } from "@/components/ui/top-nav"
```

- [ ] **Step 2: Verify dev server**

```bash
just dev
```

Open http://localhost:3000/analytics. Check:
- Nav bar renders at the top
- Analytics panels fill the remaining height — no vertical scrollbar
- Page doesn't jump or shift

- [ ] **Step 3: Commit**

Write `/tmp/commit-msg.txt`:
```
feat(web): wire TopNav into root layout with flex shell

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add apps/web/src/app/layout.tsx
git commit -F /tmp/commit-msg.txt
```

---

## Task 3: AnalyticsLayout panel chrome

**Files:**
- Modify: `apps/web/src/app/analytics/AnalyticsLayout.tsx`

The current layout has:
- A `h-screen flex-col` outer div with an inline `<h1>Analytics</h1>` header strip
- `react-resizable-panels` `<Separator>` components styled as `w-1 bg-border` between panels
- Panels with no card styling

After this task:
- Outer div: `h-full flex-col bg-muted` (nav owns the top, root layout owns height)
- Header strip removed (TopNav replaces it)
- Each Panel has an inner card wrapper: `bg-card border border-border rounded-lg overflow-hidden flex flex-col`
- Separators become invisible gutters: `w-2 bg-muted cursor-col-resize hover:bg-primary/20 transition-colors`
- `CollapsedStrip` stripped of its own background (card wrapper provides it)

- [ ] **Step 1: Update AnalyticsLayout.tsx**

Replace the entire `return` block of `AnalyticsLayout` (lines 61–112 in the current file):

```tsx
return (
  <div className="flex h-full flex-col bg-muted">
    <Group orientation="horizontal" className="flex-1 p-2">
      <Panel
        panelRef={treeRef}
        defaultSize={20}
        minSize={3}
        collapsible
        collapsedSize={COLLAPSED_SIZE}
        onResize={onTreeResize}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
          {treeCollapsed ? (
            <CollapsedStrip label="Fields" onClick={toggleTree} />
          ) : (
            <FieldTreePanel
              onCollapse={toggleTree}
              query={query}
              onQueryChange={handleQueryChange}
            />
          )}
        </div>
      </Panel>
      <Separator className="w-2 cursor-col-resize bg-muted transition-colors hover:bg-primary/20" />
      <Panel
        panelRef={builderRef}
        defaultSize={25}
        minSize={3}
        collapsible
        collapsedSize={COLLAPSED_SIZE}
        onResize={onBuilderResize}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
          {builderCollapsed ? (
            <CollapsedStrip label="Query" onClick={toggleBuilder} />
          ) : (
            <QueryBuilderPanel
              onCollapse={toggleBuilder}
              query={query}
              onQueryChange={handleQueryChange}
              onResult={setResult}
            />
          )}
        </div>
      </Panel>
      <Separator className="w-2 cursor-col-resize bg-muted transition-colors hover:bg-primary/20" />
      <Panel defaultSize={55} minSize={20}>
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
          <ResultsPanel result={result} query={query} />
        </div>
      </Panel>
    </Group>
  </div>
)
```

Also replace the `CollapsedStrip` function (lines 114–129):

```tsx
function CollapsedStrip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full cursor-pointer items-center justify-center transition-colors hover:bg-muted/60"
    >
      <span
        className="text-xs font-medium tracking-widest text-muted-foreground"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        {label}
      </span>
    </button>
  )
}
```

- [ ] **Step 2: Verify in browser**

With `just dev` running, open http://localhost:3000/analytics. Check:
- Three panels render as raised white cards on a muted grey workspace
- Resize handles (the gaps between cards) are draggable — drag to resize panels
- Collapsed strip (click × on Fields or Query) fills its card cleanly
- No vertical scrollbar on the page
- Dark mode (use the nav theme toggle) — cards render as dark surfaces on a darker workspace

- [ ] **Step 3: Commit**

Write `/tmp/commit-msg.txt`:
```
feat(web): restyle analytics panels as raised cards on muted workspace

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add apps/web/src/app/analytics/AnalyticsLayout.tsx
git commit -F /tmp/commit-msg.txt
```

---

## Task 4: Panel header tints

**Files:**
- Modify: `apps/web/src/app/analytics/FieldTreePanel.tsx`
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.tsx`
- Modify: `apps/web/src/app/analytics/ResultsPanel.tsx`

Each panel header strip gets `bg-muted/50` to create a subtle tint that separates it from the panel body. The outer `border-r border-border` on `FieldTreePanel` and `QueryBuilderPanel` is removed — the card wrapper now provides all borders.

- [ ] **Step 1: Update FieldTreePanel.tsx**

In `FieldTreePanel.tsx`, find the outer div (line 134):
```tsx
<div className="flex h-full flex-col border-r border-border">
```
Change to:
```tsx
<div className="flex h-full flex-col">
```

Find the panel header div (line 135):
```tsx
<div className="flex items-center justify-between border-b border-border px-3 py-2">
```
Change to:
```tsx
<div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
```

- [ ] **Step 2: Update QueryBuilderPanel.tsx**

In `QueryBuilderPanel.tsx`, find the outer div (line 83):
```tsx
<div className="flex h-full flex-col border-r border-border">
```
Change to:
```tsx
<div className="flex h-full flex-col">
```

Find the panel header div (line 84):
```tsx
<div className="flex items-center justify-between border-b border-border px-3 py-2">
```
Change to:
```tsx
<div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
```

- [ ] **Step 3: Update ResultsPanel.tsx**

In `ResultsPanel.tsx`, find the header div (line 31):
```tsx
<div className="flex items-center justify-between border-b border-border px-4 py-2">
```
Change to:
```tsx
<div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
```

- [ ] **Step 4: Run lint + typecheck**

```bash
just lint
just typecheck
```

Both should pass with no errors.

- [ ] **Step 5: Verify in browser**

With `just dev` running, open http://localhost:3000/analytics. Check:
- All three panel headers have a subtle tinted background strip
- The tint is consistent across Fields, Query Builder, and Results panels
- Run a query (select a dataset → add a row field → Run) — Results header renders with tint in both empty and populated states
- Dark mode — tint is still visible and readable

- [ ] **Step 6: Commit**

Write `/tmp/commit-msg.txt`:
```
feat(web): add muted header tint to all analytics panel headers

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add apps/web/src/app/analytics/FieldTreePanel.tsx apps/web/src/app/analytics/QueryBuilderPanel.tsx apps/web/src/app/analytics/ResultsPanel.tsx
git commit -F /tmp/commit-msg.txt
```

---

## Acceptance Checklist

Run through these after all tasks are complete:

- [ ] Nav renders in light and dark mode — no `dark:` colour overrides introduced
- [ ] Active "Analytics" nav link is highlighted on `/analytics`
- [ ] Three analytics panels render as raised cards on a muted workspace
- [ ] All three panel headers have consistent `bg-muted/50` tint
- [ ] Panel resize handles (gutters between cards) are draggable
- [ ] No vertical scrollbar on the analytics page
- [ ] Storybook `TopNav / Default` story passes a11y (run `just storybook` and check accessibility panel)
- [ ] `just lint` passes
- [ ] `just typecheck` passes
- [ ] No raw hex values introduced in any modified file
- [ ] `text-primary` not used as a text colour in any modified file
