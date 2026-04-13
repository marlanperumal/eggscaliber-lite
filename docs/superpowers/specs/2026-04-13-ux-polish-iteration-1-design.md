# UX Polish — Iteration 1: App Shell & Panel Chrome

**Status:** Approved  
**Date:** 2026-04-13  
**Roadmap:** Sub-project 4, Iteration 1

## Goal

Bring the analytics UI from a bare-bones prototype to a polished, recognisable product shell. Specifically: add a branded top navigation bar and replace the flat analytics panel layout with visually distinct raised-card panels.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Nav contents | Logo + nav links + user avatar + theme toggle | Signals multi-user product; avatar is placeholder for Clerk wiring later |
| Nav visual style | Branded (uses `--nav` token — dark navy variant of steel-blue palette) | Strong brand presence; clearly distinct from page content |
| Dark mode | Token-system handles both modes automatically — no `dark:` overrides | `--nav` is `s[900]` in light, `s[950]` in dark |
| Panel chrome | Raised cards (white/dark panels floating on `bg-muted` workspace tray) | Clear spatial separation; common in analytics tools |
| Nav placement | Root layout (`app/layout.tsx`) | Simplest; Iteration 4 will redesign the home page anyway |
| Implementation approach | One new component (`TopNav`), update existing files | Right-sized — no premature module splitting |

## Components

### `TopNav` (new) — `apps/web/src/components/ui/top-nav.tsx`

A full-width navigation bar rendered at the top of every page.

**Structure (left → right):**
1. Logo — `themeConfig.brand.name` as text (`font-bold tracking-tight`). Slot exists for a future image via `logoUrl`.
2. Nav links — `usePathname()` for active detection. One link now: "Analytics" → `/analytics`. Inactive: `text-primary-foreground/70`. Active: `text-primary-foreground bg-white/15 rounded-md`.
3. Right side — `ThemeToggle` (existing) + `Avatar` (shadcn, already installed). Avatar shows static initials placeholder `"MP"`, ready for `useUser()` from Clerk in a future iteration.

**Sizing:** `h-12` (48px), `px-4` padding, `bg-nav text-primary-foreground`.

**Storybook:** `top-nav.stories.tsx` colocated in `components/ui/`. One story, a11y passing.

### `app/layout.tsx` (updated)

- `<body>` gains `flex flex-col min-h-screen`.
- `<TopNav />` inserted before `{children}`.
- `{children}` wrapped in `<main className="flex-1 overflow-hidden">` so the analytics panel fills the remaining viewport height correctly.

### `AnalyticsLayout` (updated) — `apps/web/src/app/analytics/AnalyticsLayout.tsx`

**Removals:**
- Inline `<h1>Analytics</h1>` header strip — nav replaces it.
- `h-screen` on the outer div → `h-full` (root layout now owns viewport height).
- `<Separator>` components between panels — card gaps handle visual separation.

**Additions:**
- Outer div gains `bg-muted` (the workspace tray background).
- `<Group>` gains `gap-2 p-2` for card breathing room.
- Each `<Panel>` gets an inner wrapper: `bg-card border border-border rounded-lg overflow-hidden flex flex-col`.
- `CollapsedStrip` updated: `bg-card border border-border rounded-lg`.

### Panel headers (updated) — `FieldTreePanel` and `QueryBuilderPanel`

The header strip in both panels gains `bg-muted/50` — a subtle tint that separates the header from the panel body without introducing a new token.

## File Changes

| File | Change |
|---|---|
| `apps/web/src/components/ui/top-nav.tsx` | Create |
| `apps/web/src/components/ui/top-nav.stories.tsx` | Create |
| `apps/web/src/app/layout.tsx` | Update — add TopNav + body flex shell |
| `apps/web/src/app/analytics/AnalyticsLayout.tsx` | Update — remove header, add card chrome |
| `apps/web/src/app/analytics/FieldTreePanel.tsx` | Update — panel header background |
| `apps/web/src/app/analytics/QueryBuilderPanel.tsx` | Update — panel header background |

## Out of Scope

- Clerk `useUser()` integration for avatar — deferred to a future auth iteration.
- Home page (`/`) redesign — Iteration 4.
- Query builder control styling (tabs, select, pill groups) — Iteration 2.
- Empty and loading states — Iteration 3.

## Acceptance Criteria

- [ ] Nav renders in both light and dark mode with correct contrast (no `dark:` overrides).
- [ ] Active nav link highlights correctly on `/analytics`.
- [ ] Analytics panels render as raised cards on a muted workspace background.
- [ ] Panel headers have the subtle tinted strip.
- [ ] No vertical scrollbar on the analytics page — panels fill the viewport below the nav.
- [ ] Storybook `TopNav` story passes a11y.
- [ ] No raw hex values or `text-primary` as text colour introduced.
