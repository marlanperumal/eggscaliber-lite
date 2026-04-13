# Design System — Spec

**Sub-project:** 4 — UX Polish, Iteration 0  
**Date:** 2026-04-13  
**Status:** Approved

---

## Overview

Establish a production-grade design system for Eggscaliber Lite before any UI polish work begins. All subsequent iterations (app shell, query builder controls, empty states, home page) build on this foundation.

The system is light by design — enough to be consistent and extensible, no more. It must support:
- Light and dark modes (user-selectable + system default)
- A single `theme.config.ts` that a deployer can edit to re-brand the entire app (white-label, Option A)
- WCAG AA accessibility for all text/background pairs
- Shadcn as the component library

---

## 1. Colour System

### Approach: oklch with hue shifting

All colours are derived from a single oklch base value using a perceptually uniform scale. Unlike HSL (which just varies lightness), this scale also rotates hue as lightness changes — warmer toward highlights, cooler toward shadows — mimicking how colour behaves under real light. This produces visually distinct steps that don't collapse into muddy darks or washed-out lights.

This technique is used by Tailwind v4 internally and is directly compatible with our stack.

### Default palette: Crimson / Rose

Base: `oklch(0.533 0.223 14deg)` — a vivid crimson, hue angle 14°.

**Scale (11 steps, hue-shifted):**

| Step | oklch | Role |
|------|-------|------|
| 50 | `oklch(0.971 0.012 28deg)` | page background (light) |
| 100 | `oklch(0.938 0.032 25deg)` | — |
| 200 | `oklch(0.886 0.072 22deg)` | border (light) |
| 300 | `oklch(0.820 0.130 19deg)` | muted-foreground (dark), ring (dark) |
| 400 | `oklch(0.726 0.185 17deg)` | — |
| 500 | `oklch(0.620 0.220 15deg)` | — |
| 600 | `oklch(0.533 0.223 14deg)` | **primary** (both modes) |
| 700 | `oklch(0.440 0.195 10deg)` | primary hover (light) |
| 800 | `oklch(0.345 0.155 5deg)` | muted-foreground (light), border (dark) |
| 900 | `oklch(0.265 0.110 2deg)` | nav (light), card (dark) |
| 950 | `oklch(0.190 0.070 358deg)` | foreground (light), background (dark), nav (dark) |

### Semantic tokens

| Token | Light | Dark |
|-------|-------|------|
| `--background` | s[50] | s[950] |
| `--foreground` | s[950] | s[50] |
| `--card` | `#ffffff` | s[900] |
| `--card-foreground` | s[950] | s[50] |
| `--primary` | s[600] | s[400] |
| `--primary-foreground` | `#ffffff` | s[950] |
| `--secondary` | s[100] | s[800] |
| `--secondary-foreground` | s[900] | s[100] |
| `--muted` | s[50] | s[900] |
| `--muted-foreground` | s[800] | s[300] |
| `--accent` | s[100] | s[800] |
| `--accent-foreground` | s[900] | s[100] |
| `--destructive` | `DestructiveConfig.light` | `DestructiveConfig.dark` |
| `--destructive-foreground` | `#ffffff` | `DestructiveConfig.foregroundDark` |
| `--border` | s[200] | s[800] |
| `--input` | s[200] | s[800] |
| `--ring` | s[600] | s[400] |
| `--nav` | s[900] | s[950] |
| `--radius` | `0.5rem` | `0.5rem` |

**Non-shadcn token:** `--nav` is a custom token for the top navigation bar background. It is not part of the shadcn spec but is required because the nav uses a distinctly darker background than `--card`.

### Critical accessibility rule

**`--primary` (`s[600]` light / `s[400]` dark) must never be used as text colour on any surface.** It is reserved exclusively for interactive element backgrounds (buttons, active chips, focus rings, selected state indicators). Text contrast on these elements is achieved via `--primary-foreground`.

For branded text labels (section headers, group labels), use `--muted-foreground` (`s[800]` light / `s[300]` dark), which passes WCAG AAA on all surfaces.

**Why primary differs between modes:**  
In light mode, `s[600]` is dark enough for white text (≥4.5:1 on white bg). In dark mode, `s[600]` becomes too dark — it would fail as outline-button text on dark surfaces. `s[400]` passes 4.5:1 as outline text on the dark background, and is paired with `s[950]` as foreground so filled buttons remain readable (≥6:1). The correct approach is to use different primary steps per mode rather than keeping primary constant.

### Destructive colour

The destructive token is palette-specific. It is configured via an optional `destructive` field in `ThemeConfig` (`DestructiveConfig`). If omitted, `DEFAULT_DESTRUCTIVE` (dark violet, visually distinct from warm primaries) is used. Cool-hue palettes (blue, teal, steel) should supply a conventional red instead.

### Neutral text for inactive/secondary items

In dark mode, secondary/inactive text (e.g. unselected field tree items) must use `#9ca3af` (gray-400), not `#6b7280` (gray-500). Gray-500 only achieves 3.95:1 on dark card surfaces — below AA threshold. Gray-400 achieves 7.53:1 (AAA ✓).

---

## 2. Typography

**Font:** Inter (already loaded via Next.js font optimisation). No change.

**Scale (data-dense — Option B):** 14px body is the standard for information-dense analytical tools (Linear, Metabase, Retool). 16px body wastes screen space on a 3-panel analytics layout.

| Role | Size | Weight | Other |
|------|------|--------|-------|
| Page title | 20px | 700 | tracking: -0.3px |
| Section heading | 16px | 600 | tracking: -0.2px |
| Panel title | 14px | 600 | — |
| Body | 14px | 400 | line-height: 1.5 |
| Secondary / captions | 12px | 400 | — |
| Section label | 11px | 600 | uppercase, letter-spacing: 0.6px |

**Token usage:** No custom CSS variables needed for typography — Tailwind utility classes (`text-sm`, `text-xs`, `font-semibold`, etc.) cover the scale. Conventions are documented here and enforced through component implementations.

---

## 3. Spacing

Tailwind's default 4px base grid. No custom spacing tokens required.

**Analytics UI conventions:**
- Panel internal padding: `p-4` (16px)
- Panel gap: `gap-2` (8px)
- Section gap: `gap-6` (24px)
- Inline element gap: `gap-2` (8px)

---

## 4. Border Radius

Mapped to Tailwind utilities. The shadcn `--radius` variable is set to `0.5rem` (8px) — unchanged from shadcn default.

| Radius | Usage |
|--------|-------|
| `rounded` (4px) | Chips, badges, table cells |
| `rounded-md` (6px) | Buttons, inputs, selects |
| `rounded-lg` (8px) | Panels, cards, dropdowns |
| `rounded-xl` (12px) | Modals, large surfaces |
| `rounded-full` | Avatars, toggle pills |

---

## 5. Theme Architecture

### File structure

```
apps/web/src/
  config/
    theme.config.ts       ← deployer edits this
  lib/
    theme.ts              ← generateOklchScale(), generateThemeCSS()
  app/
    layout.tsx            ← injects <style> + ThemeProvider
    globals.css           ← Tailwind import only (no hardcoded tokens)
```

### theme.config.ts

The single file a deployer edits to re-brand the app. Fully typed.
Named presets live in the `themes` object; changing the `themeConfig` export
switches the entire palette at build time.

```typescript
import type { ThemeConfig } from '@/lib/theme'

export const themes = {
  orange: {  // warm crimson/rose — default
    palette: { baseHue: 14, baseChroma: 0.223, hueShift: 14 },
    brand: { name: 'Eggscaliber', logoUrl: null },
    radius: '0.5rem',
    // destructive omitted → DEFAULT_DESTRUCTIVE (dark violet)
  },
  steel: {   // cool steel-blue
    palette: { baseHue: 213, baseChroma: 0.16, hueShift: 12 },
    brand: { name: 'Eggscaliber', logoUrl: null },
    radius: '0.5rem',
    destructive: {
      light: 'oklch(0.44 0.22 27deg)',
      dark: 'oklch(0.65 0.22 27deg)',
      foregroundDark: 'oklch(0.12 0.08 27deg)',
    },
  },
} satisfies Record<string, ThemeConfig>

// ← change "orange" to "steel" to switch palette
export const themeConfig = themes.orange
```

### lib/theme.ts

`generateOklchScale(palette)` — produces all 11 steps. Each step applies:
- A fixed lightness (L) value
- A chroma multiplier (C × multiplier, peaks at s[600])
- A hue offset (ΔH: positive = toward orange/highlight, negative = toward magenta/shadow)

`generateThemeCSS(config)` — maps scale steps to all semantic tokens, returns a CSS string with `:root` and `.dark` blocks.

The scale formula guarantees that any valid hue/chroma combination produces a full, accessible, visually consistent palette. White-labelling requires editing only `baseHue` and `baseChroma`.

### layout.tsx

```typescript
import { ThemeProvider } from 'next-themes'
import { themeConfig } from '@/config/theme.config'
import { generateThemeCSS } from '@/lib/theme'

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: generateThemeCSS(themeConfig) }} />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

`globals.css` retains only the Tailwind `@import` — all token definitions move to `generateThemeCSS()`.

### globals.css after migration

```css
@import "tailwindcss";
```

All `:root` and `.dark` variable blocks are removed — they are generated by `generateThemeCSS()` and injected at render time.

---

## 6. Theme Switching

**Library:** `next-themes`

- `defaultTheme="system"` — reads `prefers-color-scheme` on first load
- `attribute="class"` — adds `.dark` to `<html>`, triggering our `.dark` CSS variables
- `enableSystem` — tracks OS-level changes in real time
- `disableTransitionOnChange` — prevents flash during mode switch
- `suppressHydrationWarning` on `<html>` — prevents SSR hydration mismatch

**ThemeToggle component:** A `useTheme()` client component in the nav bar with three options: System / Light / Dark. Implemented as a shadcn `DropdownMenu` triggered by a sun/moon icon button — not a cycling icon toggle, which is inaccessible to keyboard and screen reader users.

---

## 7. Shadcn Components

### Existing (keep as-is)

All four hand-rolled components already follow shadcn conventions exactly (Radix primitives, CVA, `cn()`, correct token names). No migration needed — they will automatically reflect the new palette once `globals.css` tokens are updated.

| Component | Notes |
|-----------|-------|
| `Button` | Identical to shadcn canonical. Keep. |
| `Badge` | Identical to shadcn canonical. Keep. |
| `Card` | Identical to shadcn canonical. Keep. |
| `Input` | **Extended** — adds `label` and `error` props. Better than shadcn default. Keep. Do not overwrite with `npx shadcn add input`. |

### To install (Iteration 0)

```bash
npx shadcn add select tabs separator skeleton tooltip toggle-group dropdown-menu avatar
```

All will automatically pick up the oklch token system via CSS variables.

### Future iterations (do not install now)

`dialog`, `popover`, `toast`, `sheet` — as needed in Iterations 1–4.

---

## 8. Accessibility

**Standard:** WCAG AA minimum for all text/background pairs. AAA where achievable without design compromise.

**Rules enforced by this design system:**
- `text-primary` is forbidden for body or label text — use `text-foreground` or `text-muted-foreground`
- Dark mode inactive/secondary text: `#9ca3af` (gray-400), not `#6b7280` (gray-500)
- Primary colour reserved for interactive elements ≥ the large-text threshold

**Tooling:**
- `storybook-addon-a11y` — installed alongside shadcn components. Adds an accessibility panel to every Storybook story, catching contrast failures at component level.
- All token pairs verified with WCAG contrast formula before spec was finalised (results documented in brainstorming session 2026-04-13).

---

## 9. White-Label (Option A — Config File)

A deployer clones the repo, edits `apps/web/src/config/theme.config.ts`, and redeploys.
They can either pick a named preset (`themes.orange`, `themes.steel`) or add their own entry
to the `themes` object — two values (`baseHue`, `baseChroma`) re-theme the entire app.
All scale steps, semantic tokens, hover states, and shadows derive from them via `generateOklchScale()`.

Optional overrides per preset: `brand.name`, `brand.logoUrl`, `radius`, `destructive`.

**Path to Option B (admin UI):** The `ThemeConfig` type and `generateThemeCSS()` function are designed to accept the same shape from any source. When Option B is needed, store the config in the database per tenant and serve it from an API route rather than importing from a static file.

---

## Out of scope

- Custom font choices (Inter stays; font override can be added to `ThemeConfig` later)
- Dark mode chart colour scales (Recharts palette update is part of Iteration 2)
- Animation/transition tokens
- Responsive breakpoints (Tailwind defaults are sufficient)
