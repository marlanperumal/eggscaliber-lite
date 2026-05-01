# Design Review & Surface Audit — Sub-project 11, Phase 1

**Date:** 2026-04-23
**Sub-project:** 11 — Design Review & Redesign
**Phase:** 1 of 5 (audit + principles; no production code)
**Feeds:** Phase 2 (divergent-concept generation in Claude Design)

## Context

Eggscaliber-Lite ships today as a working product. The ten sub-projects that preceded this one delivered the data model, analytics engine, UX polish, upload flow, AI interface, auth, MCP, and functional verification. The product is usable end-to-end, seeded with real data, and deployed.

Before continuing with feature work (mobile support, platform hardening, analytics v2, and the other items on the roadmap), we are pausing to ask whether the *shape* of the product is the right foundation for the next phase — or whether a bolder direction would serve users better. This spec is the audit half of that exercise. It establishes principles, audits the current surfaces against them, and names the questions that the redesign exploration (Phase 2) must answer.

**No production code changes in this sub-project.** Outputs are this spec, Phase 2 mockups/prototypes in Claude Design, and a final redesign spec that feeds sub-project 12 implementation.

## Decisions taken upfront

Settled before this audit began, via brainstorm:

- **Primary user: market-research / insights analyst.** Technical-but-not-engineer, lives in the app all day, wants speed and density. Secondary user: data-curious business stakeholder who dips in occasionally.
- **Ambition: full rethink.** The redesign may propose new interaction models, reshaped information architecture, and prune or relocate surfaces that don't earn their spot. This is explicitly not an incremental refresh.
- **Palette: steel stays.** The orange palette preset is deleted after the redesign ships. All Phase 2 concepts generated against steel only.
- **North-star references:** Hex (product shape for data/notebook), Linear (density, keyboard, chrome), Attio (data-table aesthetic).
- **Anti-references:** Displayr, Crunch.io, SPSS. The direct competitors all look dated; positioning opportunity is a modern-looking, fast, AI-native alternative.
- **Mobile scope (three tiers):**
  - *Tier 1 (designed mobile-first):* AI chat — ask a question, get results as tables/charts/commentary. This is the primary mobile use case.
  - *Tier 2 (don't break):* read-only view of existing analyses.
  - *Tier 3 (desktop only):* upload, metadata editing, query building, admin, org settings. Mobile users see a "desktop required" gate, not a broken layout.
- **Hard constraints the redesign must respect:**
  - Clerk-owned surfaces (sign-in, sign-up, user profile widget) — we don't own the UI
  - Recharts as charting library
  - Entity hierarchy: Package → Collection → Dataset → Field
  - Five field types: categorical, ordinal, numeric, multi-response, identifier (colours may change)
  - Dark-mode parity (every surface ships both modes)
  - WCAG AA contrast
- **On the table (explicit):**
  - Cross-tab and trending as the two analysis modes (could be merged, extended)
  - `/ai` as a separate destination (may become ambient)
  - Keyboard-first / command-palette as primary input
  - Field-type semantic colours (currently hardcoded hex — may move to derived tokens)

## Design principles

Six principles, **ordered by priority** — the priority ordering is load-bearing: when two principles conflict in Phase 2, the higher-priority principle wins.

### 1. AI is a capability, not a destination. *(highest priority)*
AI lives where the work is, not on a separate page. On desktop, AI is available alongside whatever the analyst is doing — a side panel, an inline action, a command-palette entry — and knows the context (current dataset, current query). On mobile, AI *is* the product: the whole screen, the primary interaction. A `/ai` route that is disconnected from dataset context is exactly what this principle rejects.

- *Violates:* current `/ai` page — disconnected from analytics, no visible dataset context, no path back into the query builder with the AI's output
- *Honours:* nothing yet
- *North star:* Hex's AI-in-notebook model; Raycast's AI command

### 2. Honest about loading, empty, and failure.
Skeleton loading, empty states that explain *why* and suggest a next action, error states with recovery. No page ever renders as just nav chrome + a heading. If a surface doesn't have content for a given user, it tells them why and what to do next.

- *Violates:* `/ai` empty state (bare input, no suggestions, no dataset context); `/org/groups` (column headers only, no context); `/admin` (bare "No organisations"); `/datasets/[id]` (honest but dead-end)
- *Honours:* Query Builder empty state (illustrated, explanatory); datasets-list populated state
- *North star:* Linear's empty states; Stripe's loading skeletons

### 3. Friendly to onboard, restrained to disappear.
Power users start as first-time users. The product is warm and instructive on first encounter — empty states explain, the home page guides, hints surface key concepts — and quietly retreats as the analyst becomes productive. Personality lives in the moments that matter for new users; restraint dominates the daily-use moments. A first-time user should feel welcomed without ever blocking a returning user.

- *Violates:* `/ai` empty state (no welcome, no example prompts); `/datasets` (no first-time onboarding for "how do I get a dataset in here"); top nav (no hint that ⌘K exists, once we add it); current home hero (decorative for new users without teaching).
- *Honours:* Query Builder empty state (illustrated + explanatory — points new users at what to do).
- *Reference:* Linear's onboarding panels; Notion's "What's this?" affordances; Stripe's first-time-success states.
- *Tension with #4 (density), resolved by:* For first-time-user moments (empty states, onboarding home, never-used surfaces), generosity wins. For daily-use moments (populated analytics, datasets list), density wins. Most surfaces have *both* modes; the redesign makes the mode-switch explicit (e.g., dismissible onboarding banners; "show me" affordances; progressive disclosure of advanced controls).

### 4. Data density over decoration.
Analyst-primary means information-per-pixel beats breathing-room-per-pixel. Decoration has to earn its space the same way data does. Visual quiet comes from restrained colour and hierarchy, not from empty margins. Density is calibrated to user state per principle #3 — generous for new users learning the product, dense for returning users who know what they're doing.

- *Violates:* `/` home hero (half the viewport is whitespace around a CTA); `/ai` empty state
- *Honours:* `/datasets` list (packed table); Query Builder zone chips
- *North star:* Attio for tables, Linear for chrome density

### 5. Navigation reflects frequency. Investment reflects importance.
Three distinct rules in one principle:
- **Navigation rule:** Top-nav real estate is scarce and reflects how *often* analysts do a thing. High-frequency workflows get the fastest path. Rare-use workflows (admin, org settings, API tokens) move to the user menu, org menu, or ⌘K — one level deeper, never hidden.
- **Investment rule:** Every surface gets the same craft regardless of audience size. Admin, org settings, API tokens, and analytics all get the full principles treatment. Decision-makers (buyers, procurement, adopters) often live in the rare-use surfaces — a crappy admin experience is a deal-breaker regardless of how nice analytics feels.
- **Routing rule:** URL routes are cheap in Next.js App Router. Add them freely for shareability. The question is never "should this have a route" — it's always "where does it appear in the nav" and "how well is it built".

- *Violates:* top nav has `/ai` even though AI's natural home is ambient; API Tokens implemented with less care than `/datasets`; `/admin` empty state is bare
- *Honours:* `/datasets` (right nav placement, invested appropriately)

### 6. Keyboard is first-class, not a courtesy.
Every action has a keyboard path. A command palette (⌘K) is a primary input method, not a power-user easter egg. Shortcut hints are visible where the action lives. Mouse and drag remain supported but are never the only path.

- *Violates:* every primary action in the current product — no global ⌘K, no visible shortcuts, query-building requires drag
- *Honours:* nothing yet (aspirational)
- *North star:* Linear's ⌘K, Raycast's input-method discipline

### What's absent (deliberately)
- *Dark mode parity* — floor requirement, not a principle
- *Accessibility (WCAG AA)* — floor requirement, not a principle
- *Brand personality / "delight" beyond onboarding* — outside first-time-user moments (covered by principle #3), personality lives in typography, motion restraint, and occasional well-placed moments; not in mascots or novelty

## Cross-cutting audits

Six areas that apply everywhere. The real work is per-surface, but these patterns need to be canonicalised before surface-level design lands.

### a. Top nav chrome
Always-visible dark-teal bar: logo, four links (Datasets / Analytics / AI), theme toggle, org switcher, user menu.

- **Gap:** no global search or command palette; "No organisation selected" badge occupies prime real estate for every user who hasn't joined an org, with no call to action; no breadcrumb or contextual title (you can't tell from the nav which dataset/query you're in).
- **Redesign posture:** retain the concept, make it carry more of the workload. Add ⌘K as first-class chrome. Replace "No organisation selected" with either nothing or a clear onboarding nudge. Add a context breadcrumb for data-surface pages.

### b. Empty states
Wildly inconsistent — Query Builder has illustrated empty state with headline + copy; `/ai`, `/org/groups`, and `/admin` are bare.

- **Gap:** no documented pattern; empty states are one-off per surface.
- **Redesign posture:** canonicalise a single pattern and retrofit every surface. Empty states have *two roles* per principles #2 and #3: explain what's missing and what to do (correctness) AND teach what this surface is for (onboarding). See load-bearing Q8 for the specific style + depth question.

### c. Loading states
Minimally invested. No skeleton pattern visible in captures; likely ad-hoc `useEffect` + spinner.

- **Gap:** no shared loading vocabulary.
- **Redesign posture:** adopt a skeleton convention (shadcn has one) at component level — not page level. Every data-surface panel has a skeleton.

### d. Density / spacing
Varies wildly across surfaces. Analytics and datasets-list are genuinely dense; home and AI waste most of the viewport.

- **Gap:** no shared density target per surface class.
- **Redesign posture:** define 2–3 density tiers (data surface / transactional surface / marketing surface) with explicit spacing tokens per tier.

### e. Motion / transitions
Effectively none today. Sub-project 12 has animation/transition tokens as an open item.

- **Gap:** motion personality is undefined.
- **Redesign posture:** lean Linear — quiet, confirmation-scope motion, no scroll-triggered pageantry. Define 3 motion tokens (micro for hover/press, macro for panel transitions, enter for page-level).

### f. Mobile baseline
Nothing designed mobile-first today.

- **Gap:** Tier 1 (AI chat) has zero mobile design; Tier 2 (view analyses) likely renders but painfully; Tier 3 surfaces aren't trying.
- **Redesign posture:** design AI chat mobile-first as its own canvas (Tier 1); design a read-only analysis view that works well on mobile (Tier 2); add a "desktop required" gate on Tier 3 surfaces for mobile users.

### Explicitly not covered
Iconography (lucide works), form controls (shadcn defaults), toasts (sonner is wired), typography (exists and working). These are left alone in Phase 2 unless a per-surface exploration surfaces a specific need.

## Per-surface audits

Each surface: one-line current state → key weaknesses → **redesign posture** with rationale.

### Home (`/` and `/home`)
**Current:** marketing-style hero + CTA + right-side illustration. Same for authed and unauth.

**Weaknesses:** violates density principle (#4); identical for authed + unauth — authed users get a marketing page instead of a workspace; no onboarding for first-time users; no resumption hooks for returning users.

**Posture: Split routes — Rethink (authed) / Keep (unauth).** `/` for authed users redirects to `/home`; unauth `/` keeps the marketing hero. `/home` is the *authed workspace + onboarding gateway*:
- For **first-time / low-activity users** it's primarily a teaching surface — guided next actions, dataset onboarding hint, "try asking AI" example prompts, "what's a Package?" / "what's a Dataset?" cards.
- For **returning / high-activity users** it's a workspace — recent queries, pinned datasets, "resume where you left off", ambient AI entry.
- Same route, two density modes, mode chosen from a user-activity signal (e.g. `recent_queries.length > 0` or `last_seen_at` recency). Honours principle #3 (friendly to onboard, restrained to disappear).

The exact workspace + onboarding shape and the mode-switch mechanic are load-bearing Q4.

### Datasets list (`/datasets`)
**Current:** dense paginated table with filters (package, collection) and search.

**Weaknesses:** "View" dead-ends at a placeholder; no bulk actions; no pinned/favourite datasets.

**Posture: Refine.** Structure is already right (Attio-like). Fix the dead-end by routing "View" to analytics pre-filtered. Add favourites + bulk actions as secondary work.

### Dataset detail (`/datasets/[id]`)
**Current:** intentional placeholder card — "planned as part of Ingestion V2".

**Posture: Rethink content, keep route.** The URL is the shareable handle to "this dataset". Content becomes analytics pre-filtered to that dataset — either by redirect or by rendering the analytics surface with dataset preselected. Routing rule (principle #5) says routes are cheap; keep the URL.

### Dataset upload wizard
**Current:** 5 steps — File & Hierarchy → Field Detection → Reconciliation → Metadata → Review & Commit.

**Weaknesses:** 5 steps feels bureaucratic for first-time upload; reconciliation sits with equal weight to file-upload despite being power-use.

**Posture: Refine.** Collapse Field Detection + Metadata into one live inline editor (field detection becomes the Metadata step's loading state) → 4 steps. Skip Reconciliation when there's no prior dataset in the collection. Vertical step rail instead of top banner.

### Analytics (`/analytics`) — the product's centre of gravity
**Current:** three panels (Fields | Query Builder | Results). Mode toggle (Cross-tab / Trending). Measure matrix. Table/Chart toggle.

**Weaknesses:**
- Three-panel chrome is present even for simple questions (no collapse)
- Mode toggle doesn't change panel structure — cross-tab and trending share identical chrome despite different needs
- No saved queries, no versioning, no sharing
- Arriving from `/datasets` View doesn't pre-filter the dataset (broken context)
- No ambient AI — the analyst has to leave for `/ai` with no context

**Posture: Rethink (the biggest job).** This is where most C-ambition work happens. Open questions: Fields as a collapsible sidebar? Query Builder morphs with mode? Results canvas supports multiple visible at once? AI as persistent side panel or ⌘K modal? Save/version/share as first-class actions? See load-bearing Q1, Q2, Q3.

### AI chat (`/ai`)
**Current:** single input at bottom of an otherwise empty canvas. Streams responses.

**Weaknesses:** violates principle #1 most flagrantly — AI lives as a destination, disconnected from dataset context, no suggestions, no conversation history.

**Posture: Rethink content, keep route.**
- *Desktop:* `/ai` keeps the URL — the dedicated AI canvas is still reachable — but AI is *primarily* ambient on `/analytics` (right-side panel, ⌘K modal). The `/ai` route stops being the *only* way to reach AI.
- *Mobile:* `/ai` IS the primary mobile landing surface. Dedicated mobile layout, conversation history, full-screen results. See Q6 for conversation model.

### Account (`/account`)
**Current:** Clerk UserProfile widget (top) + API Tokens section (bottom, visually subordinate).

**Weaknesses:** MCP/PAT management — a primary product capability for technical decision-makers — visually subordinate to Clerk's widget; no clear path to "I want to connect Claude Desktop/Code".

**Posture: Keep Clerk part (hard constraint); Relocate + Invest in API Tokens.** API Tokens moves to either (a) a Clerk UserProfile custom page (preferred — stays in `/account` routing, promoted visually), or (b) a dedicated `/account/api-tokens` route. Either way: proper first-class surface with setup guidance (Claude Desktop config snippet, Claude Code config snippet), not an afterthought panel.

### Admin (`/admin`)
**Current:** Subscriptions / Packages tabs with org selector sidebar. Superuser-only.

**Weaknesses:** earns a top-level nav slot despite being rare-use superuser-only; empty state is bare ("No organisations").

**Posture: Relocate (nav only) + Invest.** Nav link moves to user menu dropdown — admin isn't *frequent*, doesn't earn top-nav real estate. But the *surface* gets more polish, not less: real empty states, seeded-data path for dev, keyboard navigation. Admin users are decision-makers (principle #5 investment rule).

### Org groups (`/org/groups`)
**Current:** column headers (Name / Members / Packages), search, empty for users without an org.

**Weaknesses:** dedicated top-level route for org-settings functionality; empty for most users.

**Posture: Relocate (nav only) + Invest.** Moves under an "Organisation" dropdown triggered from the org switcher — probably as a Clerk `<OrganizationProfile />` custom page (consistent with the API Tokens pattern on `/account`). Surface itself gets invested in at the same quality bar as analytics.

### Sign-in / Sign-up (Clerk-owned)
**Current:** Clerk's default widgets, no customisation beyond routing.

**Posture: Keep.** We don't own Clerk's UI. Optional polish: brand the page frame (logo, copy, colours) via Clerk's `appearance` API.

### Cross-surface consequence — top nav after redesign

| Nav item today | After redesign |
|---|---|
| Eggscaliber logo | Kept |
| Datasets | Kept — primary workflow |
| Analytics | Kept — primary workflow |
| AI | Removed on desktop (ambient); Primary on mobile |
| Theme toggle | Kept |
| Org switcher | Kept + "Organisation settings" menu (groups, subscription) |
| User menu | Kept + Admin, Account, API Tokens |
| *(new)* ⌘K | Added — primary discovery + action surface |

Desktop nav distils to: **Datasets · Analytics** + org switcher + theme toggle + ⌘K + user menu. Mobile nav: **Ask AI** primary, everything else behind a menu.

## Load-bearing questions for Phase 2

Each question has (a) options, (b) what it shapes downstream, (c) a prompt template for Claude Design.

### Q1. What does ambient AI look like on `/analytics`?
- **Options:** (a) persistent right-side panel, always visible, collapsible; (b) ⌘K modal that floats over the canvas; (c) inline action on individual zones ("ask about this breakdown"); (d) all three at different scopes.
- **Shapes:** Analytics screen real estate, query-builder width, keyboard shortcut system, conversation persistence model.
- **Prompt:** "Show three distinct ambient AI integrations on the analytics surface — (a) right-side panel, (b) floating ⌘K-invoked modal, (c) inline per-zone — each rendered against the same query state (brand_awareness × gender crosstab). Show both light and dark."

### Q2. Does the Query Builder morph with mode?
- **Options:** (a) cross-tab and trending share chrome (current); (b) mode-adaptive zones (cross-tab: Rows/Columns/Breakdown; trending: Time axis/Series/Breakdown); (c) unified shape but relabelled per mode.
- **Shapes:** How analysts switch modes mid-query; whether a third mode (distribution, regression) is plausible future extension.
- **Prompt:** "Show the Query Builder in cross-tab mode and trending mode side by side. Each should fit its mode's needs without feeling like a shared shell. Include the mode-switch affordance."

### Q3. Multi-result layout on `/analytics` — notebook, canvas, or tabs?
- **Options:** (a) notebook — vertically stacked cells (Hex-like); (b) canvas — freely draggable result panels (Figma-like); (c) tabs — browser-like, one query per tab; (d) hybrid — single "current result" with sidebar history.
- **Shapes:** Whether analysis is conversational or one-shot; how saved queries surface; what "share" means; state complexity.
- **Prompt:** "Show four analyses on screen simultaneously in three different layouts: notebook (stacked), canvas (draggable), tabs. For each, show the transition from 'just one result' to 'four results'."

### Q4. How does `/home` onboard new users while staying out of the way for returning users?
- **Options for *shape*:** (a) workspace-with-onboarding-banner — recent queries + pinned datasets, dismissible "Welcome / try this" cards layered on top; (b) redirect to `/analytics` for returning users, dedicated `/home` for first-timers only; (c) traditional dashboard with KPIs; (d) ask-AI-first splash (Raycast-style centred input) that gradually fills with workspace content as the user accumulates history.
- **Options for *mode-switch mechanic*:** (i) dismissible cards — same layout, banner stack visible until dismissed; (ii) state-driven layout — `/home` reshapes between teaching mode and workspace mode based on activity signal, no explicit dismiss; (iii) progressive — teaching elements fade out one at a time as related actions are taken (e.g., "what's a Dataset?" card disappears once the user opens any dataset).
- **Shapes:** First impression after sign-in; whether home is a destination or a default route; Tier 2 mobile entry; how aggressively the product self-teaches.
- **Prompt:** "Design `/home` for two user states side by side: (1) brand-new user — no datasets, no queries, no AI history; (2) daily user — 12 saved queries, 3 pinned datasets, ongoing AI conversations. The shift between states should be elegant, not a separate page. Show three different mode-switch mechanics — dismissible cards, state-driven layout reshape, and progressive fade-out — applied to the same visual concept."

### Q5. ⌘K command palette — what's in it?
- **Options:** (a) navigation only; (b) navigation + actions (run query, save, share, switch dataset, change mode); (c) navigation + actions + AI entry point (type a question directly); (d) all of the above plus fuzzy search across datasets, saved queries, fields.
- **Shapes:** How aggressively keyboard-first the product becomes; whether top nav can shrink further; how AI is invoked (d makes "press ⌘K, type a question" the primary AI path).
- **Prompt:** "Show the ⌘K command palette in three scopes of ambition: navigation-only, navigation+actions, and navigation+actions+AI. For each, show the palette open on the analytics page with 'brand' typed and a realistic set of matches."

### Q6. Mobile AI — conversation model?
- **Options:** (a) one persistent global thread; (b) per-dataset threads (conversation follows the dataset); (c) ephemeral — each session starts fresh; (d) persistent thread per user-named topic.
- **Shapes:** Mobile navigation (is there a thread list?); how desktop and mobile AI reconcile; persistence cost.
- **Prompt:** "Design the mobile AI experience. Show: (1) the landing screen, (2) mid-conversation with a table result, (3) mid-conversation with a chart result, (4) conversation history / thread switcher. Assume Tier 1 mobile scope — AI is the product on mobile."

### Q7. Field-type colour treatment?
- **Options:** (a) keep current semantic hues but move them to tokens; (b) derive 6 field-type colours from the chart series tokens (so whole product uses one colour language); (c) reduce field-type signalling to monochrome + iconography (no colour coding).
- **Shapes:** How "noisy" the field tree looks; whether field type is a visual or label affordance; cohesion with chart series colours.
- **Prompt:** "Show the field tree + a crosstab result side by side, with three treatments of field-type colour: (a) current semantic hues, (b) derived from chart tokens, (c) monochrome + icons only. Judge which feels most cohesive with the overall steel palette."

### Q8. Empty-state illustration system + teaching depth?
- **Options for *style*:** (a) keep the current illustrated style and extend it to new surfaces (AI, admin, org groups); (b) shift to typographic empty-state pattern — bold heading + muted copy + action button (Linear/Stripe style); (c) hybrid — illustrations for "no data yet", typography for "no permission / not configured".
- **Options for *depth* (per principle #3):** (i) terse — heading + one-line copy + action; (ii) explanatory — heading + paragraph + action + "what this surface is for" link; (iii) two-tier — terse for users with prior activity in adjacent surfaces (familiar with the product), explanatory for true first-timers.
- **Shapes:** Personality level; production cost; how much the product self-teaches; whether empty states stay relevant once the user is no longer new.
- **Prompt:** "Show empty states across five surfaces: Query Builder (no dataset), Results (no query run yet), `/ai` (new conversation), `/admin` (no orgs), `/org/groups` (no org selected). Render each in illustration-vs-typographic style AND in terse-vs-explanatory depth (4 cells per surface). Pick the combination that fits the most surfaces best."

### Q9. How do new users discover power-user features?
- **Options:** (a) discoverable through use — keyboard shortcut hints appear on second action (e.g., after the user clicks "Save", a toast says "next time, ⌘S"); (b) guided spotlight tour on first sign-in; (c) persistent "tips" surface on `/home` rotating through features; (d) `⌘K` palette has a "Learn the shortcuts" / "What can I do here?" entry that's always visible; (e) just-in-time hints — when user does X, surface "did you know ⌘K does this?".
- **Shapes:** Whether the product needs a guided-tour system at all; how aggressively keyboard discoverability is invested in; whether a "What's new" surface is needed; how principle #3 (friendly-to-restrained) and principle #6 (keyboard-first) coexist.
- **Prompt:** "Show three approaches to power-user-feature discoverability for a new analyst's first session: (a) guided spotlight tour on first sign-in, (b) ambient just-in-time hints during natural use, (c) persistent learn-the-product card on `/home`. Each shown without obscuring the first useful action and without nagging returning users."

## Success criteria for Phase 2

Phase 2 (divergent-concept generation in Claude Design) is complete when:

1. Each of the 9 load-bearing questions above has at least 2 distinct visual answers produced in Claude Design
2. The redesigned `/analytics` surface is shown end-to-end at data-sufficient density in both light and dark
3. The redesigned mobile AI experience is shown end-to-end (landing → conversation → result → history)
4. The redesigned empty-state pattern is applied to all 5 specified surfaces
5. The field-type colour treatment decision is made (one of Q7's three options chosen, with evidence)
6. Top nav + ⌘K + user menu shown populated with the agreed structure
7. Every artefact passes the no-raw-colour grep check (per CLAUDE.md rule 6)

Phase 2 output is reviewed against the 6 principles in priority order. Concepts that violate principle #1 (AI as destination) or #2 (empty states) are not candidates regardless of visual polish.

## What Phase 1 does not cover

- Implementation details (components, state management, data-fetching)
- Backend API changes (e.g., saved queries table, conversation persistence)
- Specific Claude Design prompts beyond the 8 templates (follow-ups are Phase 2's job)
- Writing the sub-project 12 implementation plan (that's Phase 3)

## Appendix — captured surfaces for reference

Screenshots at `/tmp/claude-design-screenshots/` (captured 2026-04-23):
- 31 live-app captures (unauth, authed light, authed dark)
- 18 Storybook captures (upload wizard metadata-editor flow, light + dark)
- `README.md` documenting anomalies (dead-end dataset detail, API Tokens visually subordinate, "No organisation selected" noise, bare AI empty state, trending/cross-tab chrome sameness)
- Known Storybook bug: `WizardShell` aggregator stories render Step 1 regardless of target step in iframe mode (prompt to fix is in the session transcript)

## Appendix — architecture stress-test

The user flagged at ambition-level decision (C, rethink) that the redesign tests how easily the backend + frontend system design can absorb changes of this shape. Specifically worth watching in Phase 2:

- **Ambient AI on analytics** — does the current AI surface implementation separate "conversation state" from "UI surface" cleanly, or is it bolted to `/ai`'s page shell? If bolted, what's the cost to extract?
- **Saved queries** — no backend table exists. A real saved/versioned/shared queries feature requires schema work, not just UI.
- **Multi-result canvas** — the current analytics page assumes one query in flight. Rethinking to N simultaneous results requires state model work.
- **Dataset pre-filtered analytics** — arriving at `/analytics?dataset=X` should preselect the dataset in the query builder. That's a URL-state integration question (nuqs), potentially surfacing existing gaps.
- **Mobile Tier 1 AI** — can the existing AI streaming work render as a mobile-first layout without a second implementation, or does mobile need its own surface?

These don't need to be answered in this spec — they surface as implementation risks in sub-project 12. But they are real, and Phase 2 concepts that ignore them will produce plans that don't survive contact with the code.
