# Design System Patterns

Practical implementation reference for the Eggscaliber Lite design system.
For the rationale behind these decisions, see
`docs/superpowers/specs/2026-04-13-design-system-design.md`.

## Colour Tokens — What Goes Where

All colour is expressed via CSS custom properties. Never use raw hex values
or Tailwind colour utilities (e.g. `bg-red-500`) in components — always use
semantic token utilities.

| Token utility | Use for |
|---|---|
| `bg-background` | Page background |
| `bg-card` | Panel / card surfaces |
| `bg-primary` | Interactive element backgrounds (buttons, active chips) |
| `bg-muted` | Subtle backgrounds (empty drop zones, section backgrounds) |
| `text-foreground` | All body and heading text |
| `text-muted-foreground` | Section labels, group headings, captions, inactive items |
| `text-primary-foreground` | Text on top of primary-coloured backgrounds only |
| `border-border` | All panel and input borders |
| `ring-ring` | Focus rings |
| `bg-nav` | Top navigation bar background (custom token) |
| `text-nav-foreground` | Text/icons on the nav bar (always `#ffffff`; use `/opacity` modifier for inactive states: `text-nav-foreground/70`) |
| `--chart-1` … `--chart-8` | Chart series colours — 8 hues evenly spaced from the brand base hue (read via `getComputedStyle`, not Tailwind utilities) |
| `--field-type-categorical` … `--field-type-numeric` | Field-type indicator badge backgrounds — fixed semantic colours, not theme-derived (read via inline `style={{ background: "var(--field-type-X)" }}`) |

### Chart series colours

Chart libraries (e.g. recharts) require actual color values for `stroke`/`fill` props — CSS class names are not supported. Read `--chart-1` through `--chart-8` at render time via `getComputedStyle`:

```tsx
function useChartColors(): string[] {
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement)
    return Array.from({ length: 8 }, (_, i) =>
      style.getPropertyValue(`--chart-${i + 1}`).trim(),
    )
  }, [])
}
```

`getComputedStyle` returns the currently active value, so dark mode is handled automatically. Never hardcode hex values for chart series — always go through the chart tokens.

### Critical rule — never use `text-primary`

`--primary` is reserved exclusively for interactive element **backgrounds**.
It must never be used as a text colour on any surface. Text contrast on
primary-coloured surfaces is handled by `text-primary-foreground` (`#ffffff`).

```tsx
// CORRECT — branded label text
<span className="text-muted-foreground text-xs font-semibold uppercase">
  Rows
</span>

// WRONG — primary as text colour, fails WCAG AA on light surfaces
<span className="text-primary text-xs font-semibold uppercase">
  Rows
</span>
```

### Soft selection chip (tag/badge)

For "selected field" chips with a soft primary-tinted background, use the `bg-primary/10 border-primary/30 text-primary` pattern. This is **not** the same as using `text-primary` as body text — it is specifically for small interactive chips where the primary-tinted background makes the primary text color readable as a selection indicator.

```tsx
// CORRECT — soft chip indicating a selected field
<div className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
  <span>Field Name</span>
  <button type="button" className="text-primary/60 hover:text-primary">
    <X className="h-2.5 w-2.5" />
  </button>
</div>

// WRONG — text-primary as body/paragraph text
<p className="text-primary">Description text here</p>
```

This pattern is permitted only for chip/badge-sized selection indicators, not for any readable body text or labels.

### Dark mode — secondary/inactive text

Use `text-muted-foreground` for all secondary/inactive text. The token
resolves to `s[800]` in light mode and `s[300]` in dark mode — both pass
WCAG AA. Do not use `text-gray-500` (`#6b7280`) in dark mode; it fails AA
on dark card surfaces (3.95:1).

### Dark mode — no manual `dark:` overrides

The CSS variable system handles light/dark automatically. Do not write
`dark:text-*` or `dark:bg-*` overrides in component classes — add the
token to `generateThemeCSS()` in `lib/theme.ts` instead.

```tsx
// CORRECT — token handles both modes
<div className="bg-card text-card-foreground">...</div>

// WRONG — manual dark mode override
<div className="bg-white dark:bg-rose-950 text-rose-950 dark:text-rose-50">
  ...
</div>
```

## Typography

Font: **Inter** (loaded via `next/font/google` in `layout.tsx`).

| Role | Tailwind classes |
|---|---|
| Page title | `text-xl font-bold tracking-tight` |
| Section heading | `text-base font-semibold tracking-tight` |
| Panel title | `text-sm font-semibold` |
| Body | `text-sm` (14px — default, no class needed if set on `body`) |
| Secondary / captions | `text-xs text-muted-foreground` |
| Section label | `text-[11px] font-semibold uppercase tracking-wide text-muted-foreground` |

Do not use `text-2xl` or larger for in-app UI — those sizes are for
marketing/landing pages only.

## Spacing Conventions (Analytics UI)

| Context | Class |
|---|---|
| Panel internal padding | `p-4` |
| Panel gap (between panels) | `gap-2` |
| Section gap (within a panel) | `gap-6` |
| Inline element gap | `gap-2` |

## Border Radius

Use the semantic mapping — do not pass arbitrary values.

| Context | Class |
|---|---|
| Chips, badges, table cells | `rounded` (4px) |
| Buttons, inputs, selects | `rounded-md` (6px) |
| Panels, cards, dropdowns | `rounded-lg` (8px) |
| Modals, large surfaces | `rounded-xl` (12px) |
| Avatars, toggle pills | `rounded-full` |

## Components

### Existing (hand-rolled, shadcn-compatible)

These are already wired to the token system. Use them as-is.

- `Button` — variants: `default`, `destructive`, `outline`, `secondary`,
  `ghost`, `link`; sizes: `default`, `sm`, `lg`, `icon`
- `Badge` — variants: `default`, `secondary`, `destructive`, `outline`
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
  `CardFooter`
- `Input` — extended with `label` and `error` props. Do not overwrite with
  `npx shadcn add input` — our version is intentionally richer.

### Installed via shadcn

Use `npx shadcn add <name>` to install. Do not hand-roll these.

- `Select`, `Tabs`, `Separator`, `Skeleton`, `Tooltip`, `ToggleGroup`,
  `DropdownMenu`, `Avatar`

New components needed in future iterations: `Dialog`, `Popover`, `Toast`.

## Theme Config

The design system is driven by `apps/web/src/config/theme.config.ts`.
Named theme presets live in the `themes` object. Switch palette by changing
one line:

```typescript
// ← change "orange" to "steel" (or any key in the themes object)
export const themeConfig = themes.orange
```

Available presets:

| Key | Description | Destructive |
|-----|-------------|-------------|
| `orange` | Warm crimson/rose — the default Eggscaliber palette | Dark violet (default) |
| `steel` | Cool steel-blue — muted, professional | Conventional red |

To add a new palette, add an entry to the `themes` object:

```typescript
export const themes = {
  orange: {
    palette: { baseHue: 14, baseChroma: 0.223, hueShift: 14 },
    brand: { name: 'Eggscaliber', logoUrl: null },
    radius: '0.5rem',
    // destructive omitted → uses DEFAULT_DESTRUCTIVE (dark violet)
  },
  steel: {
    palette: { baseHue: 213, baseChroma: 0.16, hueShift: 12 },
    brand: { name: 'Eggscaliber', logoUrl: null },
    radius: '0.5rem',
    destructive: {
      light: 'oklch(0.44 0.22 27deg)',      // --destructive in :root
      dark: 'oklch(0.65 0.22 27deg)',       // --destructive in .dark
      foregroundDark: 'oklch(0.12 0.08 27deg)', // --destructive-foreground in .dark
    },
  },
} satisfies Record<string, ThemeConfig>
```

### Destructive colour override

By default the destructive tokens use a dark violet (`DEFAULT_DESTRUCTIVE`
from `lib/theme.ts`), which is visually distinct from any warm primary.
For cool-hue palettes (blue, teal) where violet reads as "close to primary",
supply a `destructive` config on the theme preset — typically a conventional red.
Light mode foreground is always `#ffffff`; dark mode foreground is set via `foregroundDark`.

CSS tokens are generated by `lib/theme.ts` and injected at render time.
`globals.css` contains only `@import "tailwindcss"` — do not add `:root`
variable blocks there.

## SVG Illustrations

Inline SVG illustrations must adapt to dark/light mode through the token
system — never hardcode fill or stroke colours.

Set `className="text-muted-foreground"` (or another semantic text token) on
the root `<svg>` element and use `fill="currentColor"` / `stroke="currentColor"`
on all shapes. The `currentColor` keyword inherits the CSS `color` property,
so the illustration picks up the token automatically without any `dark:` overrides.

```tsx
export function QueryZoneIllustration() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className="text-muted-foreground"
      aria-hidden="true"
    >
      <path fill="currentColor" d="M12 4 ..." />
    </svg>
  )
}
```

Store illustration files in an `illustrations/` subdirectory next to the
components that use them (e.g. `analytics/illustrations/QueryZoneIllustration.tsx`).
Mark them `aria-hidden="true"` — they are decorative; the surrounding
`EmptyState` component provides the accessible title and description.

## Accessibility

Every component with a visual state (hover, focus, active, disabled, error)
must pass WCAG AA contrast (4.5:1 for text, 3:1 for UI components).

The token system is pre-verified for AA compliance. Violations only occur
when tokens are misused (e.g. `text-primary` as body text) or when raw
colour values bypass the token system.

Storybook `addon-a11y` is configured — every story shows an accessibility
panel. All stories must pass before merging. See `docs/testing.md` for the
full Storybook a11y workflow.

### Loading spinners

Spinner elements must carry `role="status"` — Biome's `useAriaPropsSupportedByRole`
rule rejects `aria-label` on a bare `<div>`. Always pair them together:

```tsx
<div role="status" aria-label="Loading" className="...">
  {/* spinner SVG or animation */}
</div>
```

Without `role="status"`, screen readers will not announce the loading state,
and the lint step will fail.
