# Home Page — Design Spec

**Date:** 2026-04-15  
**Roadmap:** Sub-project 4 — UX Polish, Iteration 4

---

## Overview

Replace the placeholder home page (`/`) with a minimal split-hero landing that gives the app a polished entry point and routes users to the analytics engine.

---

## Layout

Full-viewport split hero. The `main` element in `layout.tsx` already fills available height (`flex-1 overflow-hidden`); the `HomePage` component uses `h-full flex items-center justify-center` to vertically centre the content.

Two columns side by side (45/55 split):

- **Left column (~45%):** eyebrow label, headline, body text, CTA button — left-aligned, vertically centred
- **Right column (~55%):** `AnalyticsPreviewIllustration` wrapped in a card surface — slightly inset, centred

On narrow viewports (< `md` breakpoint) the right column hides and the left column centres in the full width. No mobile-specific layout is required beyond that.

---

## Content

| Element | Text |
|---|---|
| Eyebrow | `Data analysis platform` |
| Headline | `Survey insights, without the code` |
| Body | `Cross-tab, trend, and breakdown analysis across datasets. Configure queries visually, get results instantly.` |
| CTA | `Open Analytics →` → links to `/analytics` |

Headline uses `text-4xl font-bold tracking-tight` — the design system permits `text-2xl` and above for marketing/landing pages (in-app UI is capped at `text-xl`).

---

## Components

### `HomePage` (`apps/web/src/app/HomePage.tsx`)

Server component. Renders the split-hero layout using design-system tokens only — no raw hex, no `dark:` overrides. Uses `Button` (variant `default`, size `lg`) + Next.js `Link` for the CTA.

Storybook story: `HomePage.stories.tsx` colocated, a11y passing.

### `AnalyticsPreviewIllustration` (`apps/web/src/app/AnalyticsPreviewIllustration.tsx`)

Inline SVG component. Depicts the analytics three-panel layout as a styled wireframe — abstract bar/rectangle shapes representing the field tree, query builder, and results panels. No real content or data.

Token usage: `className="text-muted-foreground"` on the root `<svg>`; all shapes use `fill="currentColor"` or `stroke="currentColor"`. The surrounding card frame uses `bg-card border-border` tokens. This makes the illustration dark-mode aware automatically with no `dark:` overrides.

Marked `aria-hidden="true"` — decorative; the surrounding `HomePage` provides all accessible context.

Storybook story: `AnalyticsPreviewIllustration.stories.tsx` colocated, a11y passing.

### `page.tsx` (`apps/web/src/app/page.tsx`)

Modified to simply render `<HomePage />`. All layout logic moves to `HomePage.tsx`.

---

## CTA Behaviour

The CTA links directly to `/analytics`. The analytics page handles its own feature-flag check (returning 404 if `analytics-engine` is disabled). No additional guard is needed on the home page — the flag is expected to be enabled in all environments where the home page is visible.

---

## Files Changed

| File | Action |
|---|---|
| `apps/web/src/app/page.tsx` | Modify — render `<HomePage />` |
| `apps/web/src/app/HomePage.tsx` | Create |
| `apps/web/src/app/HomePage.stories.tsx` | Create |
| `apps/web/src/app/AnalyticsPreviewIllustration.tsx` | Create |
| `apps/web/src/app/AnalyticsPreviewIllustration.stories.tsx` | Create |

---

## Out of Scope

- Mobile-optimised layout beyond hiding the right column below `md`
- Authentication or per-user CTAs
- Animated transitions or scroll effects
- Any content beyond the single split-hero section
