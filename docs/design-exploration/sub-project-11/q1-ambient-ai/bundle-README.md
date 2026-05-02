# Handoff: Ambient AI on the Analytics Surface

## Overview

Three explorations of how to embed an AI assistant inside the Eggscaliber
analytics workspace. The workspace is a 3-panel **session model** —

1. **Source** (dataset selector + variable-depth field tree)
2. **Query Builder** (rows / columns / breakdown zones, view selector,
   filters, run)
3. **Analysis** (a vertical stack of saved query cards — drag, duplicate,
   delete, collapse; each card renders chart / trend / table / both)

Each variant places the AI surface differently:

| Variant | Surface | Best for |
|---|---|---|
| **A** Right-side rail | Persistent collapsible column with thread, session pulldown, and card-reference pills | Heavy ongoing use; AI is a co-pilot in every analysis |
| **B** ⌘K modal | Floating spotlight invoked on demand; rows are answers, new-query actions, edits to existing cards, or jumps | Power users; keyboard-first |
| **C** Inline + per-card asks | "Ask" buttons on each Query Builder zone and on individual Q-cards in the stack | Targeted, contextual questions without leaving the work |

7 mockups total: light + dark for A, B, C, plus a fourth "collapsed rail"
state for A.

## About the design files

The files in this bundle are **design references built in HTML/JSX** — they
are prototypes that show intended layout, behavior, and visual treatment.
They are **not production code to ship verbatim**.

The task is to **recreate these designs in your target environment** (the
real Eggscaliber web app — Next.js / React / Tailwind — or whichever
codebase consumes this work) using your established component library
(shadcn/ui), tokens, and patterns. The HTML/JSX here cuts corners
intentionally (inline data, mocked dropdowns, `readOnly` inputs, no real
state machine) to keep the prototype legible.

## Fidelity

**High-fidelity.** Spacing, type, color tokens, hierarchy, hover/active
states, and interaction copy are all settled. Implement the structure and
behavior pixel-faithfully against your existing `colors_and_type.css` /
shadcn components. The 4-color **field-type** palette (categorical /
multi-response / ordinal / numeric) and the per-zone palette (rows /
columns / breakdown) are part of the visual contract — preserve them.

---

## Information architecture

```
PageHeader
  ├─ crumb: Analyses > <analysis name> · <count> queries
  ├─ title (editable)  ·  saved-state pill
  └─ actions: Share, Export, More (icons) | + New query (primary)

Body (3-column grid + optional 4th AI column)
  ├─ P1 · Source
  │    ├─ Dataset selector (breadcrumb path · n / fields / mode)
  │    ├─ Tabs: Fields | Filters
  │    ├─ Search
  │    └─ Field tree (variable depth, expand/collapse, drag handles)
  │
  ├─ P2 · Query Builder
  │    ├─ Header
  │    │    top:  "Query Builder" + reset / more icons
  │    │    sub:  "Editing" + Q# pill
  │    ├─ View selector segmented control (Crosstab / Trend / Table / Both)
  │    ├─ Zones (Rows / Columns / Breakdown) — each is a dashed dropzone
  │    │    with letter badge, label, count, chips, and an "Ask" button
  │    │    in Variant C only
  │    ├─ Measure (segmented: Count / % / Mean / Top-2)
  │    ├─ Filters (chips)
  │    └─ Run bar
  │
  └─ P3 · Analysis (the saved-card stack)
       ├─ Header
       │    top:  "Analysis" + N queries pill + collapse-all / add / more icons
       │    sub:  Analysis name (editable)
       └─ Card stack
            └─ Each card:
               · grip + chevron + Q# + title + active pill + actions (icons)
               · meta row: dataset · query shape (mono) · view-type tag
               · body: chart | trend | table | chart+table
               · optional AI insight note (info-tinted strip)
```

Variants A/B/C add their AI surface on top of this base; the base does not
change between variants.

---

## Variants in detail

### A · Right-side rail

A 4th column (320px) appears next to P3.

```
ai-rail
  ├─ head: spark icon · "Ask Eggscaliber" + sub · history / collapse
  ├─ session pulldown: "Awareness deep-dive" · turn-count pill · history link
  ├─ thread:
  │    bot bubble (left, muted)  — answers reference cards as <Qref Q1 …/> pills
  │    user bubble (right, primary)
  ├─ suggested next (link-style buttons)
  └─ composer: input + send button + footer ("Replies create new Q cards")
```

**Collapsed state:** the rail shrinks to ~44px wide and shows just an icon,
a turn-count badge, and a "more" button. Toggle returns to full rail.

The card-reference **pill** is the central interaction — every AI message
that mentions a query renders a `Q#` badge that jumps the user to that
card in the P3 stack. Clicking the pill scrolls the stack and pulses the
card border.

### B · ⌘K modal

The full surface stays behind a 22% scrim (with 2px backdrop blur). A
~580×auto popover sits ~110px from the top.

```
modal
  ├─ input: spark + "Ask, jump, or build a query…" + esc kbd
  ├─ context strip: "Awareness deep-dive" · "Q1 active" · "Test Wave 1"
  ├─ rows grouped by section:
  │    "Answer about Q1"            — runs the question, renders the answer in-card
  │    "Add as new query…"          — creates Q5 with the proposed shape
  │    "Edit existing query"        — modifies Q3 (or whichever card the row targets)
  │    "Jump to query"              — navigates the P3 stack
  └─ footer: spark · ↑↓ ↵ ⌘K kbds
```

Every relevant row carries a `Q#` badge so users can see *which* card the
action will create or modify before committing.

### C · Inline + per-card asks

No new column. Two new affordances:

1. A small `Ask` button (sparkles icon, primary-tinted) sits in the
   top-right of every Query Builder zone. Clicking opens an inline
   popover *inside* the zone with: a paragraph answer, 3 chip suggestions,
   and a follow-up input. The active zone is highlighted with a primary
   border + soft tint.

2. Individual Q-cards in P3 can carry an `Ask Q#` button next to their
   action icons (the prototype shows it on Q2, the AI-flagged trend card).
   Clicking opens a popover scoped to that card's data.

This keeps every conversation rooted to the thing the user is looking at
— useful for "what does this column mean?" / "is this significant?" /
"what's the n on this cell?" without spinning up a full session.

---

## Tokens (already canonical in `colors_and_type.css`)

The design uses the **steel** palette by default and **only** token
references — no raw hex / rgb / hsl in any authored file. Implementations
must do the same.

### Surface

| Token | Use |
|---|---|
| `--background` | page |
| `--card` | panels |
| `--muted` | panel headers, subtle fills |
| `--accent` | hover fills |
| `--border` | hairlines |
| `--input` | input borders |
| `--ring` | focus ring |
| `--nav` / `--nav-foreground` | top nav |
| `--popover` | ⌘K modal |
| `--shadow-sm` / `--shadow-md` | segmented "on" / popover |

### Semantic

| Token | Use |
|---|---|
| `--primary` / `--primary-foreground` | CTAs, AI surface accent, active state |
| `--success` | saved dot, positive deltas |
| `--info` | AI insight notes, sparkle iconography |
| `--warning` / `--destructive` | warn/destructive states |

### Field-type palette (used in chips, tree icons)

| Type | Token |
|---|---|
| categorical | `--field-type-categorical` |
| multi-response | `--field-type-multi-response` |
| ordinal | `--field-type-ordinal` |
| numeric | `--field-type-numeric` |

Letter glyph: C / M / O / N. Always rendered as a 14–16px circle with
`color: var(--nav-foreground)` (white on the colored fill).

### Zone palette (Query Builder)

| Zone | Token | Letter |
|---|---|---|
| Rows | `--zone-rows` | R |
| Columns | `--zone-columns` | C |
| Breakdown | `--zone-breakdown` | B |

### Charts

`--chart-1` … `--chart-8`. The crosstab uses 1 / 3 / 5; the trend uses the
same 3 in series order.

### Dark mode

The artboards in this bundle scope dark mode locally with a
`[data-mode="dark"]` block at the top of `analytics-ai.css` that mirrors
the upstream `.dark` block in `colors_and_type.css`. **In your real app
you do not need this** — use the global `.dark` class on `<html>` or
wherever the existing app already toggles it. The scoped block is
prototype scaffolding.

---

## Component spec

### Top nav (`AbNav`)
- 40px tall, `--nav` background.
- Brand wordmark (700, 13px), 3 nav links (Datasets / Analytics / AI), org
  pill with green dot, 22px circular avatar.
- Active link: 14% white wash on the nav background, full-strength foreground.

### Page header (`AbPageHead`)
- `--card` background, 1px bottom border, 10px / 16px padding.
- Two-line stack: 11px crumb on top (with `›` separators, terminal segment
  bold), 15/700 title with auto-saved pill (6px green dot + 10.5px label).
- Right side: 28px square icon buttons (Share / Export / More), 1×18 vertical
  divider, then the **+ New query** primary button (CTA, 28px tall).

### Source panel (`AbDatasetPanel`)
- Header: title + 2 icon buttons (Refresh / Details).
- Dataset picker:
  - 9.5/600 caps `Dataset` label
  - Big select-style button: full breadcrumb on a single line, terminal
    segment bold; chevron rotated 90°. Hover lifts border to `--ring`.
  - Meta row: `n 4,247 · fields 38 · WEIGHTED` (mode pill is 12% primary fill).
- Tree toolbar: small segmented (Fields / Filters) + tight search input.
- Tree:
  - 3px top/bottom row padding, 12px indent per depth level.
  - Group rows: 600 weight, chevron rotates on open, count pill at right.
  - Field rows: 16px circular type-icon (C/M/O/N) on the left, 500 weight name,
    grip on hover.
  - Active field: 12% primary background + primary text.

### Query Builder (`AbQueryBuilder`)
- Header (multi-row):
  - top: "Query Builder" + reset (`x`) + more icons
  - sub: 9.5/600 "EDITING" caps + the editing Q# pill (`<Qref/>`)
- View selector: full-width 26px segmented control (Crosstab / Trend / Table / Both)
- Zones (3 stacked):
  - 1px **dashed** border tinted to the zone color (45% mix with `--border`).
  - When active: solid `--primary` border + 3px primary glow.
  - Header: 18px circle letter badge + label + count (e.g. `2/4`, mono).
  - Chips: oval, `--primary`-tinted, with the field-type circle on the left
    and the field name. 10.5px text, 1px subtle border.
  - Empty: italic muted "drag a field here…".
  - Variant C only: a primary-tinted **Ask** button absolutely positioned
    top-right at `(6, 6)`.
- Measure: 9.5/600 caps label + 4-segment fill control.
- Filters: 9.5/600 caps label + filter chips (each with an x button) +
  dashed "Add filter" affordance that turns primary on hover.
- Run bar: full-width primary "Run" + muted meta ("updates Q1").

### Analysis stack (`AbAnalysisStack` + `AnalysisCard`)
- Panel header (multi-row):
  - top: "Analysis" + count pill (mono "4 queries") + 3 icons (collapse-all
    chevron / add / more). Collapse-all icon flips between rotated states
    based on whether everything is collapsed.
  - sub: 13/600 analysis name (single line, ellipsis if too long).
- Stack body: muted background (35% mix), 10px padding, cards stacked
  with 10px gap.
- **Card** anatomy:
  - 22px grip column at left, full-height, hover-grabbable.
  - Header: chevron (rotates between 0° collapsed and 90° open) · Q# pill
    (mono, primary tint) · 13/600 title (ellipsis) · "Editing" pill if
    active · action icon row (Ask?, Duplicate, More, Delete).
  - When **collapsed**, only the header is rendered. The view-type tag
    moves inline next to the title (small `--muted` chip with chart icon).
  - Meta row (expanded only): dataset pill + mono query-shape pill +
    right-aligned view-type tag.
  - Body (expanded only): legend + chart, or trend, or table, or both.
  - Optional AI insight strip at the bottom: sparkles icon + sentence,
    background `info` 6% mix, dashed top border.
  - Active state: 1px primary border + 3px 15%-primary glow on the whole
    card; grip column gets a 14% primary tint.
- Trailing "+ New query in this analysis" dashed-border button.

### AI rail (Variant A)
- 320px column, panel-styled.
- Head: 22px primary-tinted icon square + 12/600 title + 10/500 sub.
- Session pulldown: 9.5/600 "SESSION" caps + a pill that contains the
  session name + a small mono turn-count badge + chevron. "History" link
  on the far right.
- Thread:
  - Bot bubbles align left, ≤95% width, muted-card background.
  - User bubbles align right, ≤85% width, primary fill, primary-foreground
    text. Border-radius `10 10 2 10` / `10 10 10 2` to indicate sender.
  - Inline `Qref` pills inside bubbles: small primary-tinted pill,
    primary-filled mono Q# badge, then the label.
- Suggest: 9.5/600 caps label + tappable rows that hover to primary.
- Composer: bordered input + 24px primary send button + footer line
  ("Replies create new Q cards" + ⌘ ↵ kbd).

### ⌘K modal (Variant B)
- 580px popover with `--shadow-md` + 1px primary glow.
- Input: 14/500 placeholder, primary spark icon, esc kbd.
- Context: muted bar, 9.5/600 caps "CONTEXT" + 3 mono pills.
- Rows grouped by 9.5/600 caps section labels. Row hover/selected: primary
  8% fill + 2px primary left border.
- Each row: 22px primary-tinted icon square + (rtitle, rsub) stack +
  optional Q# rcardref + kbd.
- Footer: muted bar, "Eggscaliber AI" tag + nav-key kbds.

### Inline pop (Variant C)
- Sits inside the active zone, below the chips, with `--shadow-md`.
- Head: spark + primary-tinted "Ask about Rows · brand_awareness" + close x.
- Body: paragraph answer with `<strong>` highlights + chip suggestions +
  follow-up input with 20px send button.

### Per-card "Ask Q#" (Variant C)
- 22px tall, 6px-radius, primary 8%-fill button with sparkles icon and
  "Ask Q2" label. Slots into the card's actions row before the dup/more/del
  icons.

---

## Interactions & behavior

### Field tree
- Click group row → toggle open/close.
- Drag field → drop into a Query Builder zone (chip appears, count
  increments). Real impl: HTML5 DnD or `@dnd-kit/core`.
- Active field highlighting comes from `data-active="true"` on the row.

### Query Builder
- View segmented: switches the active card's view (chart/trend/table/both).
- Zones accept drops; chips can be removed via an x button (not shown in
  prototype but present in the chip component).
- Run: triggers query execution and updates the active Q card in the stack.
- Hover the editing Q# pill in the header → links back to that card in P3.

### Analysis stack
- Card chevron toggles per-card collapse. Collapsed cards render only
  the header row with an inline view-type chip.
- "Collapse all" / "Expand all" icon button in the panel header is one
  toggle; its rotation flips based on `cards.every(c => collapsed)`.
- Cards reorder via the grip column (drag handle).
- Action icons: duplicate creates a new Q below; delete removes; more
  opens a menu (export, rename, save as template…).
- AI insight strip is just a string today; treat it as a slot for richer
  flagging UI.

### Variant A (rail)
- Toggle button collapses the rail to a 44px icon strip.
- Sending a message either answers in place (informational) or **adds a
  new Q card to the stack** (when the assistant proposes a query). The
  thread renders a card-ref pill that scrolls + pulses the new card.
- Session pulldown opens a sub-menu with prior sessions; "History" link
  opens a full session list.

### Variant B (⌘K)
- Open: `⌘K`. Close: `Esc` or `⌘K`.
- ↑↓ navigates rows; ↵ runs the highlighted action.
- Three action types — pick the right side effect:
  - **Answer**: render answer in-place (or in-card if the row carries a Q#).
  - **Add as new query**: append a card to the active analysis.
  - **Edit existing query**: target the Q# in the row's badge and apply
    the diff.
  - **Jump to query**: scroll to that card in P3.

### Variant C (inline)
- Zone "Ask" button opens the popover scoped to that zone.
- Per-card "Ask Q#" opens a popover scoped to that card.
- Both popovers stay open until an `x` is clicked or focus moves outside.

---

## State (what your store / hooks need)

```ts
type FieldType = "categorical" | "multi-response" | "ordinal" | "numeric";

interface Field { id: string; name: string; type: FieldType }
interface FieldGroup { id: string; name: string; children: TreeNode[] }
type TreeNode = Field | FieldGroup;

interface Dataset {
  id: string;
  crumb: string[];        // ["Brand Tracker", "Wave Series", "Test Wave 1"]
  rows: number;
  fieldCount: number;
  mode: "Weighted" | "Unweighted";
  fields: TreeNode[];
}

interface QueryDef {
  id: string;             // "q1"
  num: number;            // 1
  title: string;
  rows: Field[];
  cols: Field[];
  breakdown: Field[];
  measure: "Count" | "%" | "Mean" | "Top-2";
  filters: Filter[];
  view: "chart" | "trend" | "table" | "both";
  datasetId: string;      // may differ from analysis default
}

interface Analysis {
  id: string;
  name: string;
  cards: QueryDef[];
  activeCardId: string;
  collapsed: Set<string>; // per-card collapse state
}

interface AISession {
  id: string;
  analysisId: string;     // sessions are scoped to an analysis
  turns: AITurn[];
}

interface AITurn {
  role: "user" | "assistant";
  content: string;        // markdown-ish; render Q# refs as Qref pills
  refs: { num: number; cardId: string }[];
  sideEffects?:           // what this turn did to the analysis
    | { kind: "addCard"; cardId: string }
    | { kind: "editCard"; cardId: string }
    | { kind: "answerOnly" };
}
```

The `Qref` component takes a `num` and reads the analysis's card list to
resolve the `cardId` for click-to-jump. Keep it cheap; this gets used a lot.

---

## Files in this bundle

| File | Role |
|---|---|
| `Ambient AI on Analytics.html` | Entry point — embeds 7 artboards in a design canvas |
| `analytics-base.jsx` | Nav, page header, Source panel, Query Builder, Analysis stack, charts, table |
| `variants.jsx` | Three AI integrations (A rail / B ⌘K / C inline + per-card) |
| `analytics-ai.css` | All variant-specific CSS (panels, AI surfaces, charts) |
| `primitives.jsx` | Tiny shadcn-style component shims used by the design (Icon, Button, Badge, Card, Input) |
| `design-canvas.jsx` | Pan/zoom canvas host that lays out the 7 artboards |
| `colors_and_type.css` | Eggscaliber design-system tokens (steel palette default) |
| `base.css` | Reset + typography + base component styles |

To run the prototype locally: open `Ambient AI on Analytics.html` in a
browser. Pan/zoom the canvas; click an artboard label to focus it
fullscreen.

---

## Recreating in your codebase

If you're working in the real Eggscaliber web app:

1. **Reuse what exists.** The shadcn components in
   `apps/web/src/components/ui/*` already cover Button, Input, Badge,
   Card, etc. Don't reimplement them — match the prototype against those.
2. **Tokens are the source of truth.** Your real `colors_and_type.css`
   already defines `--primary`, `--zone-rows`, `--field-type-*`, etc. Use
   them; the prototype's CSS is token-only by design.
3. **Splitting work.**
   - `AnalyticsLayout` (3-col grid + optional 4th)
   - `SourcePanel` (dataset picker + tree)
   - `QueryBuilder` (zones + measure + filters + run)
   - `AnalysisStack` + `AnalysisCard` (collapsible, drag-reorderable)
   - `AIRail` / `AICommandPalette` / `AIInlinePop` — pick one based on
     the variant decision; they share most of the data model.
4. **Drag and drop.** Use `@dnd-kit/core` (already in the codebase if
   it's the standard) for both the field-tree → zone drops and the card
   reordering.
5. **AI plumbing.** Treat the assistant as a function from
   `(analysisState, userTurn) → AITurn`. Side effects on the analysis
   (addCard, editCard) should round-trip through the same store
   mutations the human-driven UI uses, so undo / autosave / history
   keep working.

If no app exists yet, start fresh in **Next.js + React + Tailwind**
(matching the prototype) and lift `colors_and_type.css` + `base.css`
verbatim — they're already token-clean.

---

## Out of scope for this handoff

- Real ⌘K keyboard plumbing.
- The ⌘K backend (search ranking, ML scoring of "what should this become").
- Real chart rendering — the prototype uses SVG and CSS-bar tricks;
  swap for the codebase's existing chart layer (likely `recharts` or a
  custom D3 wrapper).
- Authoring of new queries from natural language (the AI side effect).
  Spec'd as a side-effect kind on `AITurn`; impl is your concern.
- Persistence, autosave, export to PDF/CSV — represented as UI affordances
  but not wired.
