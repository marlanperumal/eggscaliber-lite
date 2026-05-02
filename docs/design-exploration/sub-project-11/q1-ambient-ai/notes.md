# Q1 — Ambient AI on /analytics

## Major surfaced concept (carries to Phase 3 consistency check)

**Analysis = container of multiple linked queries with an AI chat thread.**
The user introduced this in the prompt iteration. It elevates "saved
queries" to a higher-order grouping (`Analysis`) and ties AI conversation
to that grouping. Across all three options:

- The page header is `Analyses › <analysis name> · N queries · auto-saved`
- The third panel is "Analysis" — a vertical stack of saved query cards
  (Q1, Q2, Q3...) — drag, duplicate, delete, collapse; each card renders
  chart / trend / table / both
- AI conversation is per-Analysis (not per-Query), with `Qref` pills in
  bot bubbles linking to specific cards

This is a **cross-question concept** that affects:
- **Q3** (multi-result layout) — Analysis IS the multi-result container;
  the chosen layout shape is the card-stack ("notebook-like vertical"),
  not canvas or tabs
- **Q4** (home onboarding) — pinned/recent items are *Analyses*, not raw
  queries
- **Q5** (⌘K) — "Open Analysis X" becomes primary navigation; "Add as
  new query in this analysis" becomes a primary action verb
- **Q6** (mobile AI) — mobile Analysis = mobile chat thread (model is
  consistent with desktop ambient AI)

Flag this for resolution in `convergence/consistency-check.md`.

## What was generated

Three variants × two modes + one collapsed state = 7 mockups. All
honour the Analysis concept structurally:

| Variant | File(s) |
|---|---|
| A — Right-side rail (light, expanded) | `previews/a-light.png` |
| A — Right-side rail (dark, expanded) | `previews/a-dark.png` |
| A — Right-side rail (light, collapsed) | `previews/a-collapsed.png` |
| B — ⌘K modal (light) | `previews/b-light.png` |
| B — ⌘K modal (dark) | `previews/b-dark.png` |
| C — Inline + per-card asks (light) | `previews/c-light.png` |
| C — Inline + per-card asks (dark) | `previews/c-dark.png` |

The `bundle-README.md` (preserved from Claude Design's handoff) documents
the IA in detail — read it before scoring.

## Variant summary

### A — Right-side rail (320px, collapsible to ~44px)
- Persistent column with thread, session pulldown ("Awareness deep-dive"),
  history link, suggested-next chips, composer
- Thread bubbles use `Qref` pills (clickable) to link specific cards in
  the Analysis stack — clicking the pill scrolls + pulses the card border
- Collapsed state = thin rail with icon + turn-count badge + "more"
  button. Reclaims room for analysis cards.

### B — ⌘K modal
- Spotlight-style modal (~580px wide, ~110px from top, 22% scrim, 2px
  blur)
- Input + context strip ("Awareness deep-dive · Q1 active · Test Wave 1")
- Rows grouped by section: "Answer about Q1" / "Add as new query…" /
  "Edit existing query" / "Jump to query"
- Every relevant row carries a `Q#` badge so user sees *which* card the
  action will create/modify before committing

### C — Inline + per-card asks
- No new column; two new affordances:
  1. Small `Ask` button (sparkles icon) in top-right of every Query
     Builder zone — opens an inline popover with answer + 3 chip
     suggestions + follow-up input
  2. Q-cards in Analysis stack can carry an `Ask Q#` button next to
     action icons — popover scoped to that card's data
- Conversations rooted to the thing being looked at

## Initial impressions (filled in jointly)

**Lead with A; B and C added later only if they earn it.**

- **Variant A (right-side rail):** Picked as the starting point. Persistent presence is the right shape for "AI as co-pilot all day" given principle #1 priority. Collapsible rail handles the density tension.
- **Variant B (⌘K modal):** Defer — likely returns when ⌘K (Q5) lands, since the modal *is* the ⌘K surface. May then become additive to A rather than alternative.
- **Variant C (inline per-zone asks):** Defer — useful for targeted "what does this mean?" questions but risks Ask-button fatigue across the Query Builder + Analysis stack. Revisit only if A+B together leave a clear gap.

Implication for Phase 3 scoring: A is the primary direction; B/C are scored as *future additive* options, not competitors.

## Open questions for convergence

1. Can A and C coexist? A right-rail + C per-zone Ask buttons would
   over-deliver AI affordances. Likely pick one as primary.
2. Should B be additive to A or C? ⌘K is a discoverability path — even
   if A or C is the primary surface, ⌘K may still be the keyboard entry.
3. The Analysis card-stack uses a notebook-vertical metaphor — does
   that lock in Q3's answer (notebook) before Phase 3 evaluates
   canvas/tabs? Treat as strong prior, not a lock.
4. AI's ability to *add* a query to the Analysis (vs only answer about
   existing queries) is a powerful pattern — sub-project 12 must
   ensure backend supports it (saved-query writes from AI tool calls).

## Verification

- **Raw-color grep on Q1 mockup files (`analytics-ai.css`, `analytics-base.jsx`, `variants.jsx`):** PASS — only oklch literals in the token-definition section of `analytics-ai.css` (lines 31-51, sanctioned).
- **Carry-over violations in shared files:** Same `#fff` / `rgba(255,255,255,X)` issues in `base.css` as the smoke test, plus `design-canvas.jsx` chrome (Claude Design's own canvas framing) — both *outside* the eggscaliber mockup proper. Flag as a systemic Claude Design bug for the user to escalate, but not blocking.
- **Bundle path:** `/tmp/cd-out/q1/design_handoff_ambient_ai_analytics/`
- **Preview count:** 7 cropped artboards in `previews/`

## Cross-references

- Original Claude Design bundle README: `bundle-README.md`
- Audit spec: `docs/superpowers/specs/2026-04-23-design-review-surface-audit-design.md` (Q1 section)
- Plan task: `docs/superpowers/plans/2026-04-23-design-review-redesign.md` (Task 1)
