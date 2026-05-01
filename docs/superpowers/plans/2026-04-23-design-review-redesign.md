# Design Review & Redesign — Sub-project 11 Implementation Plan (Phases 2–4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Important context — this is a design-process plan, not a code plan.** No production code is written in this sub-project. Outputs are: (a) mockup/prototype bundles generated in Claude Design (a hosted Anthropic Labs product the user operates in a browser), (b) per-question evaluation notes, (c) a chosen-direction decision document, (d) the final change-list spec that drives sub-project 12 implementation.
>
> **Division of labour per task:**
> - **User** operates Claude Design in the browser (running prompts, reviewing outputs, exporting handoff bundles)
> - **Agent (Claude Code)** prepares prompt text, verifies bundle outputs against constraints, extracts previews, writes evaluation notes, commits artefacts
> - **Both** review outputs jointly before moving on
>
> The "TDD-style" structure of standard plan tasks doesn't apply. Each task here is: prepare prompt → user runs in Claude Design → user drops bundle in repo → agent verifies + extracts + commits.

**Goal:** Produce a chosen design direction for the eggscaliber-lite redesign and a concrete change-list spec ready to drive sub-project 12 implementation.

**Architecture:** Three sequential phases. Phase 2 (exploration) generates 9 distinct visual answers in Claude Design — one per load-bearing question from the spec. Phase 3 (convergence) scores outputs against the six prioritised principles and selects a direction per question. Phase 4 (spec) writes the change-list spec as a structured input to sub-project 12.

**Tech Stack:** Claude Design (hosted, browser-based, research preview); `agent-browser` CLI for capturing previews; markdown for all written deliverables; git for versioning.

**Sources:**
- Spec: `docs/superpowers/specs/2026-04-23-design-review-surface-audit-design.md`
- Captured surfaces (reference for Claude Design): `/tmp/claude-design-screenshots/` (31 live + 18 Storybook)
- Claude Design project: configured by user with steel palette + Inter fonts + extracted design system + verification mandate in project notes

---

## File Structure

```
docs/
├── design-exploration/
│   └── sub-project-11/
│       ├── q1-ambient-ai/
│       │   ├── notes.md              # what was tried, what was kept, why
│       │   └── previews/             # PNG previews extracted from bundle (light + dark)
│       ├── q2-query-builder-morph/
│       │   ├── notes.md
│       │   └── previews/
│       ├── q3-multi-result-layout/
│       ├── q4-home-onboarding/
│       ├── q5-cmdk-scope/
│       ├── q6-mobile-ai-conversation/
│       ├── q7-field-type-colours/
│       ├── q8-empty-states/
│       ├── q9-power-user-discoverability/
│       └── convergence/
│           ├── scoring-table.md      # per-question scoring against 6 principles
│           ├── decisions.md          # chosen direction per question + rationale
│           └── consistency-check.md  # cross-question contradictions resolved
└── superpowers/
    └── specs/
        └── 2026-XX-XX-design-redesign-change-list-design.md   # Phase 4 output

# Outside the repo (gitignored — Claude Design bundles are large and include fonts):
/tmp/cd-out/
├── q1/    # full handoff bundle dropped here by user
├── q2/
├── ...
```

**Why this structure:**
- Per-question folders keep exploration evidence reviewable and reversible. Each folder is self-contained.
- `previews/` (PNGs only) live in git so the exploration record survives. Full bundles stay in `/tmp` because they include 30+ MB of font files and JSX/CSS scaffolding we don't need to version-control.
- `convergence/` separates the *exploration* artefacts from the *decision* artefacts. The decision document is what informs Phase 4.
- The Phase 4 change-list spec lives where all specs live (`docs/superpowers/specs/`) so sub-project 12 finds it via the standard pattern.

---

## Pre-flight: setup tasks (do once before Phase 2)

### Task 0a: Create directory skeleton

**Files:**
- Create: `docs/design-exploration/sub-project-11/{q1-ambient-ai,q2-query-builder-morph,q3-multi-result-layout,q4-home-onboarding,q5-cmdk-scope,q6-mobile-ai-conversation,q7-field-type-colours,q8-empty-states,q9-power-user-discoverability,convergence}/previews/` (10 dirs each with `previews/` sub-dir, except convergence)

- [ ] **Step 1: Make all the directories in one shot**

```bash
mkdir -p docs/design-exploration/sub-project-11/{q1-ambient-ai,q2-query-builder-morph,q3-multi-result-layout,q4-home-onboarding,q5-cmdk-scope,q6-mobile-ai-conversation,q7-field-type-colours,q8-empty-states,q9-power-user-discoverability}/previews
mkdir -p docs/design-exploration/sub-project-11/convergence
```

- [ ] **Step 2: Add a per-folder placeholder `.gitkeep` so the empty `previews/` directories survive git**

```bash
find docs/design-exploration/sub-project-11 -type d -empty -exec touch {}/.gitkeep \;
```

- [ ] **Step 3: Commit the skeleton**

```bash
git add docs/design-exploration/sub-project-11
```

```bash
cat > /tmp/commit-msg.txt << 'EOF'
docs: scaffold design-exploration tree for sub-project 11

One folder per load-bearing question (Q1-Q9) plus convergence.
Per-question previews land in previews/; per-question notes in notes.md.
Full Claude Design bundles stay in /tmp/cd-out/ (gitignored).
EOF
git commit -F /tmp/commit-msg.txt
```

### Task 0b: Gitignore the Claude Design bundle staging area

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Verify `/tmp/cd-out/` is not in repo (it's outside repo root, so this is for documentation only — no gitignore needed). Skip if so.**

```bash
ls /tmp/cd-out/ 2>/dev/null && echo "exists" || echo "not yet"
```

- [ ] **Step 2: No commit needed — `/tmp/cd-out/` is outside the repo and won't be tracked. Done.**

### Task 0c: Confirm the Claude Design project is verification-ready

This is a *user-side* check — Claude Code can't introspect Claude Design. Confirm before generating Phase 2 prompts.

- [ ] **Step 1 (user):** Open the Claude Design project. In project notes, verify the verification mandate (the grep one-liner block) is present at the bottom of the "Any other notes" field.

Expected text in notes:
```
Before declaring any output complete, you MUST run this grep on every
.css, .jsx, .tsx, .html file you produced (exclude colors_and_type.css
and any other file that is the token definition source):

grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(' <files>

If it returns any line, you are not done. Fix every hit. Paste the empty
grep output as proof. Self-audits without this grep are not acceptable.
```

If missing: paste it now from the conversation history (or from the second-to-last response in the brainstorming session).

- [ ] **Step 2 (user):** Confirm the design system review still passes the smoke-test criteria from the brainstorming session — Inter font loaded, semantic tokens used, `text-primary` rule documented.

- [ ] **Step 3 (agent):** No action — proceed to Phase 2 once user confirms 0c step 1 and step 2.

---

## Phase 2: divergent-concept generation (Q1–Q9)

Each question follows the same task shape. The prompt text comes verbatim from the spec (`docs/superpowers/specs/2026-04-23-design-review-surface-audit-design.md`, "Load-bearing questions" section). The agent-side verification is identical for each question; only the prompt and the per-question critique focus differ.

### Task 1: Q1 — Ambient AI on `/analytics`

**Files:**
- Create: `docs/design-exploration/sub-project-11/q1-ambient-ai/notes.md`
- Create: `docs/design-exploration/sub-project-11/q1-ambient-ai/previews/*.png`
- User-side staging: `/tmp/cd-out/q1/` (Claude Design handoff bundle)

**Prompt to paste into Claude Design:**

> Show three distinct ambient AI integrations on the analytics surface — (a) right-side panel, always visible and collapsible; (b) floating ⌘K-invoked modal that overlays the canvas; (c) inline per-zone action ("ask about this breakdown" buttons on each Query Builder zone) — each rendered against the same query state (brand_awareness × gender crosstab) using `Brand Tracker › Wave Series › Test Wave 1` as the dataset. Show both light and dark for each option (6 mockups total). Use the steel palette. Honour all constraints in the project notes including the verification mandate.

**Critique focus when reviewing:** Does each option preserve query-builder readability at typical density? Where does the AI conversation history live? Does the AI know the current dataset and query without the analyst typing them? How is "convert this AI answer into a saved query" expressed?

- [ ] **Step 1 (user):** Paste the prompt above into Claude Design. Iterate as needed. Once happy with the three options × two modes, export the handoff bundle to `/tmp/cd-out/q1/`.

- [ ] **Step 2 (user):** Reply "q1 ready" in this Claude Code session.

- [ ] **Step 3 (agent):** Run the no-raw-color verification grep on the bundle.

```bash
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(' /tmp/cd-out/q1/ \
  --include='*.css' --include='*.jsx' --include='*.tsx' --include='*.html' \
  | grep -vE 'colors_and_type\.css|theme\.ts|fonts/'
```

Expected: no output. If any lines appear, report them to user — they need to either be fixed in Claude Design (preferred) or accepted as known violations with rationale logged in `notes.md`.

- [ ] **Step 4 (agent):** Extract preview PNGs from the bundle into the repo.

```bash
find /tmp/cd-out/q1 -maxdepth 2 -name '*.png' -exec cp {} docs/design-exploration/sub-project-11/q1-ambient-ai/previews/ \;
ls docs/design-exploration/sub-project-11/q1-ambient-ai/previews/
```

If no PNGs in bundle (Claude Design exports HTML/JSX, not PNGs), use `agent-browser` to render the bundle's `index.html` and screenshot:

```bash
agent-browser open "file:///tmp/cd-out/q1/Datasets - Dense List.html" \
  --state .claude/agent-browser/session.json 2>/dev/null
agent-browser wait --load networkidle
agent-browser screenshot --full docs/design-exploration/sub-project-11/q1-ambient-ai/previews/q1-option-a-right-panel-light.png
```

(Adapt filename per option/mode. Repeat for each variant in the bundle.)

- [ ] **Step 5 (agent):** Write `notes.md` for Q1.

```bash
cat > docs/design-exploration/sub-project-11/q1-ambient-ai/notes.md << 'EOF'
# Q1 — Ambient AI on /analytics

## What was generated
- Option A: persistent right-side collapsible panel (light + dark)
- Option B: floating ⌘K-invoked modal (light + dark)
- Option C: inline per-zone action buttons (light + dark)

## What we asked Claude Design to consider
- Same query state across all 3: brand_awareness × gender crosstab
- AI must know current dataset + query without re-prompting
- Conversation history must have a home in each option
- Path from AI answer to saved query must be expressed

## Initial impressions (filled in jointly with user before Phase 3)
- Option A:
- Option B:
- Option C:

## Open questions for convergence
- (filled in by agent after step 4)

## Verification
- Raw-color grep: PASS / FAIL (note specific violations if any)
- Bundle path: /tmp/cd-out/q1/
- Preview count: <N> PNGs
EOF
```

Replace the `(filled in)` and `<N>` values with real content based on the bundle inspection.

- [ ] **Step 6 (jointly with user):** Discuss the three options in this session. User adds to "Initial impressions" section of `notes.md`. Agent edits the file with the discussion.

- [ ] **Step 7 (agent):** Commit Q1 artefacts.

```bash
git add docs/design-exploration/sub-project-11/q1-ambient-ai/
```

```bash
cat > /tmp/commit-msg.txt << 'EOF'
docs(design): q1 ambient AI exploration outputs

Three options generated in Claude Design — right-panel, ⌘K modal,
inline-per-zone — each in light + dark. Notes capture initial
impressions and open questions for Phase 3 convergence.
EOF
git commit -F /tmp/commit-msg.txt
```

### Task 2: Q2 — Query Builder morph behaviour

Same task structure as Task 1; only the prompt and critique focus differ.

**Files:**
- Create: `docs/design-exploration/sub-project-11/q2-query-builder-morph/notes.md`
- Create: `docs/design-exploration/sub-project-11/q2-query-builder-morph/previews/*.png`
- Staging: `/tmp/cd-out/q2/`

**Prompt to paste into Claude Design:**

> Show the Query Builder in cross-tab mode and trending mode side by side. In cross-tab mode show three zones — Rows, Columns, Breakdown — each with realistic chips (Rows: gender; Columns: brand_awareness; Breakdown: empty drop zone). In trending mode show different zones — Time axis, Series, Breakdown — populated to fit a "brand awareness over wave" question. Each mode should fit its needs without feeling like a shared shell. Include the mode-switch affordance prominently. Show both light and dark. Use the steel palette. Honour all constraints in the project notes.

**Critique focus:** Does the chrome shift feel like the *same product*, or two products? Does state preserve across mode switches in a way that is intuitive? What happens to the "saved query" affordance when modes mean different things? Could a third mode (distribution, regression) plausibly extend this shape?

- [ ] **Step 1–7:** Same as Task 1, substituting `q1` → `q2`, `q1-ambient-ai` → `q2-query-builder-morph`. Specifically:

```bash
# Step 3 (agent verification)
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(' /tmp/cd-out/q2/ \
  --include='*.css' --include='*.jsx' --include='*.tsx' --include='*.html' \
  | grep -vE 'colors_and_type\.css|theme\.ts|fonts/'

# Step 4 (extract previews)
find /tmp/cd-out/q2 -maxdepth 2 -name '*.png' -exec cp {} docs/design-exploration/sub-project-11/q2-query-builder-morph/previews/ \;

# Step 7 (commit)
git add docs/design-exploration/sub-project-11/q2-query-builder-morph/
cat > /tmp/commit-msg.txt << 'EOF'
docs(design): q2 query builder morph exploration outputs
EOF
git commit -F /tmp/commit-msg.txt
```

`notes.md` body for Q2:

```markdown
# Q2 — Query Builder morph behaviour

## What was generated
- Cross-tab mode (light + dark): Rows / Columns / Breakdown zones
- Trending mode (light + dark): Time axis / Series / Breakdown zones
- Mode-switch affordance shown in both states

## What we asked Claude Design to consider
- Same product feel across modes
- State preservation across mode switches
- Plausibility of a third mode (distribution, regression)

## Initial impressions (filled in jointly)
- Cross-tab:
- Trending:
- Mode switch:

## Open questions for convergence

## Verification
- Raw-color grep: PASS / FAIL
- Bundle path: /tmp/cd-out/q2/
- Preview count: <N>
```

### Task 3: Q3 — Multi-result layout (notebook / canvas / tabs)

**Files:**
- Create: `docs/design-exploration/sub-project-11/q3-multi-result-layout/notes.md`
- Create: `docs/design-exploration/sub-project-11/q3-multi-result-layout/previews/*.png`
- Staging: `/tmp/cd-out/q3/`

**Prompt to paste into Claude Design:**

> Show four analyses on screen simultaneously in three different layouts: (a) notebook — stacked cells like Hex/Observable; (b) canvas — freely draggable result panels like Figma frames; (c) tabs — browser-like tabs with one query per tab. For each layout, show two states: "just one result" and "four results visible". Use realistic content: brand_awareness × gender crosstab (table), wave-over-time trend (line chart), satisfaction × age crosstab (heatmap), brand_awareness summary (single number/big-stat). Show both light and dark. Use the steel palette. Honour all constraints.

**Critique focus:** Which layout makes "compare result A to result B" cheapest? Where do saved queries surface in each? What's the cost of state management for each (dev consideration)? How does each scale to 8+ results?

- [ ] **Steps 1–7:** Same shape as Task 1, substituting `q3` and `q3-multi-result-layout`.

`notes.md` body for Q3:

```markdown
# Q3 — Multi-result layout

## What was generated
- Notebook layout (light + dark): 1 result + 4 results states
- Canvas layout (light + dark): 1 result + 4 results states
- Tabs layout (light + dark): 1 result + 4 results states

## What we asked Claude Design to consider
- Cost of "compare A to B" interaction in each
- Where saved queries surface
- Scale to 8+ results
- State complexity (acknowledged dev consideration)

## Initial impressions (filled in jointly)
- Notebook:
- Canvas:
- Tabs:

## Open questions for convergence

## Verification
- Raw-color grep: PASS / FAIL
- Bundle path: /tmp/cd-out/q3/
- Preview count: <N>
```

### Task 4: Q4 — Home onboarding mode-switch

**Files:**
- Create: `docs/design-exploration/sub-project-11/q4-home-onboarding/notes.md`
- Create: `docs/design-exploration/sub-project-11/q4-home-onboarding/previews/*.png`
- Staging: `/tmp/cd-out/q4/`

**Prompt to paste into Claude Design:**

> Design `/home` for two user states side by side: (1) brand-new user — no datasets, no queries, no AI history; (2) daily user — 12 saved queries, 3 pinned datasets, ongoing AI conversations. The shift between states should be elegant, not a separate page. Show three different mode-switch mechanics — (i) dismissible cards stacked above the workspace, (ii) state-driven layout reshape (no explicit dismiss; layout adapts to activity), (iii) progressive fade-out where teaching elements disappear one-by-one as related actions are taken — applied to the same visual concept. Show both light and dark. Use the steel palette. Honour all constraints.

**Critique focus:** Does the new-user view feel inviting without being patronising? Does the daily-user view earn the screen real estate it occupies? Which mechanic risks nagging returning users? Which risks abandoning new users too soon?

- [ ] **Steps 1–7:** Same shape as Task 1, substituting `q4` and `q4-home-onboarding`.

`notes.md` body for Q4:

```markdown
# Q4 — Home onboarding mode-switch

## What was generated
- Mode mechanic (i) dismissible cards: new + daily user states (light + dark)
- Mode mechanic (ii) state-driven layout reshape: new + daily (light + dark)
- Mode mechanic (iii) progressive fade-out: new + daily (light + dark)

## What we asked Claude Design to consider
- Inviting without patronising for new users
- Earned screen real estate for daily users
- Nagging risk vs abandonment risk

## Initial impressions (filled in jointly)
- Dismissible cards:
- State-driven reshape:
- Progressive fade-out:

## Open questions for convergence

## Verification
- Raw-color grep: PASS / FAIL
- Bundle path: /tmp/cd-out/q4/
- Preview count: <N>
```

### Task 5: Q5 — ⌘K command palette scope

**Files:**
- Create: `docs/design-exploration/sub-project-11/q5-cmdk-scope/notes.md`
- Create: `docs/design-exploration/sub-project-11/q5-cmdk-scope/previews/*.png`
- Staging: `/tmp/cd-out/q5/`

**Prompt to paste into Claude Design:**

> Show the ⌘K command palette in three scopes of ambition, each as an open palette overlaid on the analytics page with the user having typed "brand": (a) navigation-only — list of pages and surfaces matching "brand"; (b) navigation + actions — pages plus action verbs ("Run query for brand_awareness", "Switch dataset to Brand Tracker", "Save current query as 'brand awareness baseline'"); (c) navigation + actions + AI entry point — same as (b) plus a "→ Ask AI: 'brand'" entry that routes the typed text into the AI conversation. For each, show realistic match results with grouped sections (Pages / Datasets / Saved queries / Actions / AI). Show both light and dark. Use the steel palette. Honour all constraints.

**Critique focus:** Where does (c)'s AI entry sit in the result list — top, bottom, in its own section? Does (b)'s action surface introduce too many verbs? Does (a) feel useful enough to bother with? Discoverability of advanced shortcuts (relevant to Q9).

- [ ] **Steps 1–7:** Same shape, substituting `q5` and `q5-cmdk-scope`.

`notes.md` body for Q5:

```markdown
# Q5 — ⌘K command palette scope

## What was generated
- Scope (a) navigation only (light + dark)
- Scope (b) navigation + actions (light + dark)
- Scope (c) navigation + actions + AI (light + dark)

## What we asked Claude Design to consider
- Position of AI entry in result list
- Verb explosion risk in (b)
- Whether (a) earns its keep
- Discoverability path (links to Q9)

## Initial impressions (filled in jointly)
- Scope (a):
- Scope (b):
- Scope (c):

## Open questions for convergence

## Verification
- Raw-color grep: PASS / FAIL
- Bundle path: /tmp/cd-out/q5/
- Preview count: <N>
```

### Task 6: Q6 — Mobile AI conversation model

**Files:**
- Create: `docs/design-exploration/sub-project-11/q6-mobile-ai-conversation/notes.md`
- Create: `docs/design-exploration/sub-project-11/q6-mobile-ai-conversation/previews/*.png`
- Staging: `/tmp/cd-out/q6/`

**Prompt to paste into Claude Design:**

> Design the mobile AI experience as the primary mobile use case (Tier 1). Render at iPhone 14 Pro width (393px). Show four screens: (1) the landing screen — what the user sees opening the app on mobile, with example prompts; (2) mid-conversation with a table result (e.g., brand_awareness × gender crosstab — make it scrollable horizontally, not crammed); (3) mid-conversation with a chart result (e.g., brand awareness trend over waves); (4) conversation history / thread switcher. Show all four in both light and dark. Show the persistent thread model — assume one persistent global thread by default, with the option to start a new named thread visible. Use the steel palette. Honour all constraints.

**Critique focus:** Does the table fit without cramming? Is the chart legible at 393px? Where does the "switch to desktop" hint live? Where does dataset context surface (does the user need to pick one before asking, or does AI infer)?

- [ ] **Steps 1–7:** Same shape, substituting `q6` and `q6-mobile-ai-conversation`. Note: mobile previews benefit from being labelled with viewport (`*-393w-light.png`).

`notes.md` body for Q6:

```markdown
# Q6 — Mobile AI conversation model

## What was generated (393px width)
- Landing screen (light + dark)
- Conversation with table result (light + dark)
- Conversation with chart result (light + dark)
- Conversation history / thread switcher (light + dark)

## What we asked Claude Design to consider
- Table without cramming (horizontal scroll)
- Chart legibility at mobile width
- "Switch to desktop" hint placement
- Dataset context surfacing (pick first vs. AI infers)

## Initial impressions (filled in jointly)
- Landing:
- Table result:
- Chart result:
- Thread switcher:

## Open questions for convergence

## Verification
- Raw-color grep: PASS / FAIL
- Bundle path: /tmp/cd-out/q6/
- Preview count: <N>
```

### Task 7: Q7 — Field-type colour treatment

**Files:**
- Create: `docs/design-exploration/sub-project-11/q7-field-type-colours/notes.md`
- Create: `docs/design-exploration/sub-project-11/q7-field-type-colours/previews/*.png`
- Staging: `/tmp/cd-out/q7/`

**Prompt to paste into Claude Design:**

> Show the field tree (with all 5 field types represented — categorical, ordinal, numeric, multi-response, identifier) plus a crosstab result side by side, with three treatments of field-type colour: (a) keep current semantic hues (the current `--field-type-categorical` etc. tokens) — but these MUST be expressed as tokens, no raw hex anywhere in component code; (b) derive the 6 field-type colours from the chart series tokens `--chart-1` through `--chart-6` — same colour language as the charts; (c) reduce field-type signalling to monochrome differentiation (foreground tone) plus iconography — no colour coding at all, just an icon per type. Show all three side by side with the same field tree content and the same crosstab result. Show both light and dark. Use the steel palette. Honour all constraints.

**Critique focus:** Does (b)'s derivation work without conflating field type with chart series in users' minds? Does (c) lose enough signal to make the field tree harder to scan? Does (a) still feel cohesive when the rest of the product uses derived tokens?

- [ ] **Steps 1–7:** Same shape, substituting `q7` and `q7-field-type-colours`.

`notes.md` body for Q7:

```markdown
# Q7 — Field-type colour treatment

## What was generated
- Treatment (a) current semantic hues as tokens (light + dark)
- Treatment (b) derived from chart-series tokens (light + dark)
- Treatment (c) monochrome + iconography (light + dark)
- All three with same field tree + same crosstab result

## What we asked Claude Design to consider
- Conflation risk in (b) — field type vs chart series
- Scan-ability loss in (c)
- Cohesion with rest of product in (a)

## Initial impressions (filled in jointly)
- Treatment (a):
- Treatment (b):
- Treatment (c):

## Open questions for convergence

## Verification
- Raw-color grep: PASS / FAIL — special focus, since this question is colour-defined
- Bundle path: /tmp/cd-out/q7/
- Preview count: <N>
```

### Task 8: Q8 — Empty-state style + depth

**Files:**
- Create: `docs/design-exploration/sub-project-11/q8-empty-states/notes.md`
- Create: `docs/design-exploration/sub-project-11/q8-empty-states/previews/*.png`
- Staging: `/tmp/cd-out/q8/`

**Prompt to paste into Claude Design:**

> Show empty states across five surfaces simultaneously: (1) Query Builder (no dataset selected), (2) Results panel (no query run yet), (3) `/ai` (new conversation), (4) `/admin` (no orgs), (5) `/org/groups` (no org selected). For each surface, render four cells:
>
> - Cell A: illustration-style + terse depth (heading + one-line copy + action button)
> - Cell B: illustration-style + explanatory depth (heading + paragraph + action + "what this surface is for" link)
> - Cell C: typographic-style + terse depth
> - Cell D: typographic-style + explanatory depth
>
> Layout the 5 surfaces × 4 cells as a 5-row × 4-column grid. Show in light only (a single grid per page). Use the steel palette. Honour all constraints.

**Critique focus:** Which combination feels right for the *most* surfaces (cross-surface consistency matters)? Where does the explanatory depth feel appropriate vs. patronising? Are the illustrations affording one specific use-case or a family of them?

- [ ] **Steps 1–7:** Same shape, substituting `q8` and `q8-empty-states`. Note: this question generates one large grid image rather than separate variants — handle accordingly.

`notes.md` body for Q8:

```markdown
# Q8 — Empty-state style + depth

## What was generated
- 5×4 grid: 5 surfaces (Query Builder / Results / AI / Admin / Org Groups) × 4 cells (illustration-vs-typographic × terse-vs-explanatory)
- Light only (the question is about combinatorics, not modes)

## What we asked Claude Design to consider
- Cross-surface consistency
- Patronising threshold for explanatory depth
- Illustrations specific vs. family-level

## Initial impressions (filled in jointly)
- Best style+depth combination overall:
- Surfaces where the default doesn't fit:
- Production-cost trade-off (illustrations cost more):

## Open questions for convergence

## Verification
- Raw-color grep: PASS / FAIL
- Bundle path: /tmp/cd-out/q8/
- Preview count: <N>
```

### Task 9: Q9 — Power-user feature discoverability

**Files:**
- Create: `docs/design-exploration/sub-project-11/q9-power-user-discoverability/notes.md`
- Create: `docs/design-exploration/sub-project-11/q9-power-user-discoverability/previews/*.png`
- Staging: `/tmp/cd-out/q9/`

**Prompt to paste into Claude Design:**

> Show three approaches to power-user-feature discoverability for a new analyst's first session, each rendered against the same context (the user has just signed in, landed on `/home`, and is about to run their first query): (a) guided spotlight tour on first sign-in — a sequence of 4 spotlight overlays each pointing at a feature (top nav, ⌘K button, dataset picker, AI panel); (b) ambient just-in-time hints during natural use — show three states: user clicks "Save query" and a toast says "next time, ⌘S"; user opens dataset picker and a small caption says "or press ⌘D"; user opens analytics and a dismissible caption says "press ⌘K to switch surfaces"; (c) persistent learn-the-product card on `/home` — a single dismissible card that rotates through 5 tips (1 visible at a time with prev/next + dismiss-forever). Each approach must NOT obscure the first useful action and must NOT nag returning users. Show both light and dark. Use the steel palette. Honour all constraints.

**Critique focus:** Which approach respects principle #3 (friendly to onboard, restrained to disappear) best? Which has the highest "wins it once and is gone" character? Which has the lowest implementation cost (acknowledged dev consideration)?

- [ ] **Steps 1–7:** Same shape, substituting `q9` and `q9-power-user-discoverability`.

`notes.md` body for Q9:

```markdown
# Q9 — Power-user feature discoverability

## What was generated
- Approach (a) guided spotlight tour: 4 spotlight states (light + dark)
- Approach (b) ambient just-in-time hints: 3 states (light + dark)
- Approach (c) persistent learn card on /home: 5 tip rotation states (light + dark)

## What we asked Claude Design to consider
- Respect for principle #3 (friendly-to-restrained)
- "Wins it once and is gone" character
- Implementation cost

## Initial impressions (filled in jointly)
- Spotlight tour:
- JIT hints:
- Persistent card:

## Open questions for convergence

## Verification
- Raw-color grep: PASS / FAIL
- Bundle path: /tmp/cd-out/q9/
- Preview count: <N>
```

### Task 10: Phase 2 review checkpoint

After Tasks 1–9 are complete, pause to confirm Phase 2 success criteria from the spec are met before moving to convergence.

**Files:**
- All 9 question folders should be populated
- All notes.md files should have "Initial impressions" filled in by user

- [ ] **Step 1 (agent):** List the 9 folders and verify each has at least 2 distinct previews and a populated `notes.md`.

```bash
for q in docs/design-exploration/sub-project-11/q*/; do
  preview_count=$(find "$q/previews" -name '*.png' 2>/dev/null | wc -l)
  notes_size=$(wc -c < "$q/notes.md" 2>/dev/null || echo 0)
  echo "$q : $preview_count previews, $notes_size bytes notes"
done
```

Expected: 9 lines, each with `>= 2` previews and `> 500` bytes notes.

- [ ] **Step 2 (agent):** Verify against the spec's "Success criteria for Phase 2":

  1. Each of 9 questions has ≥ 2 distinct visual answers — *check from step 1 output*
  2. Redesigned `/analytics` shown end-to-end (Q1, Q2, Q3 cover this collectively)
  3. Mobile AI shown end-to-end (Q6)
  4. Empty-state pattern applied to 5 surfaces (Q8)
  5. Field-type colour decision *evidence* available (Q7) — decision happens in Phase 3
  6. Top nav + ⌘K + user menu shown populated (Q5)
  7. Every artefact passes raw-color grep — *check from per-question notes.md verification lines*

  Report any missing items.

- [ ] **Step 3 (jointly with user):** If any criteria fail, decide: re-run that question's prompt with adjustments, or accept the gap with a logged reason. Update the relevant `notes.md` either way.

- [ ] **Step 4 (agent):** Commit a Phase 2 close-out marker.

```bash
mkdir -p docs/design-exploration/sub-project-11/convergence
cat > docs/design-exploration/sub-project-11/convergence/PHASE-2-COMPLETE.md << 'EOF'
# Phase 2 (divergent-concept generation) — Closed

## Success criteria from spec — verified

1. ≥ 2 distinct visual answers per question: PASS
2. /analytics shown end-to-end (Q1, Q2, Q3): PASS
3. Mobile AI shown end-to-end (Q6): PASS
4. Empty-state pattern applied to 5 surfaces (Q8): PASS
5. Field-type colour evidence available (Q7): PASS
6. ⌘K + nav populated (Q5): PASS
7. Raw-color grep passes for all artefacts: PASS

(adjust to actuals; if any FAIL, document why and what was accepted)

## Ready to start Phase 3 (convergence)
EOF
git add docs/design-exploration/sub-project-11/convergence/PHASE-2-COMPLETE.md
cat > /tmp/commit-msg.txt << 'EOF'
docs(design): phase 2 complete — divergent-concept generation closed

All 9 load-bearing questions explored in Claude Design.
Per-question notes capture initial impressions; convergence next.
EOF
git commit -F /tmp/commit-msg.txt
```

---

## Phase 3: convergence

Three tasks. Score outputs against principles → pick a direction per question → consistency-check across questions.

### Task 11: Score Phase 2 outputs against the 6 principles

**Files:**
- Create: `docs/design-exploration/sub-project-11/convergence/scoring-table.md`

- [ ] **Step 1 (agent):** Build the scoring scaffold. For each question's options, score each against each of the 6 principles in priority order. Score 0 (violates), 1 (neutral / N/A), 2 (honours weakly), 3 (honours strongly).

```bash
cat > docs/design-exploration/sub-project-11/convergence/scoring-table.md << 'EOF'
# Phase 3 scoring table — Phase 2 outputs vs 6 prioritised principles

Score: 0 = violates, 1 = neutral, 2 = honours weakly, 3 = honours strongly.
Principles in priority order. Tie-break by higher-priority principle.

## P1 — AI is a capability, not a destination
## P2 — Honest about loading, empty, and failure
## P3 — Friendly to onboard, restrained to disappear
## P4 — Data density over decoration
## P5 — Navigation reflects frequency. Investment reflects importance.
## P6 — Keyboard is first-class, not a courtesy

---

## Q1 — Ambient AI on /analytics

| Option | P1 | P2 | P3 | P4 | P5 | P6 | Sum | Tie-break note |
|---|---|---|---|---|---|---|---|---|
| (a) right-side panel |  |  |  |  |  |  |  |  |
| (b) ⌘K modal |  |  |  |  |  |  |  |  |
| (c) inline per-zone |  |  |  |  |  |  |  |  |

## Q2 — Query Builder morph

| Option | P1 | P2 | P3 | P4 | P5 | P6 | Sum | Tie-break note |
|---|---|---|---|---|---|---|---|---|
| (a) shared chrome |  |  |  |  |  |  |  |  |
| (b) mode-adaptive zones |  |  |  |  |  |  |  |  |
| (c) unified shape relabelled |  |  |  |  |  |  |  |  |

## Q3 — Multi-result layout

| Option | P1 | P2 | P3 | P4 | P5 | P6 | Sum | Tie-break note |
|---|---|---|---|---|---|---|---|---|
| (a) notebook |  |  |  |  |  |  |  |  |
| (b) canvas |  |  |  |  |  |  |  |  |
| (c) tabs |  |  |  |  |  |  |  |  |
| (d) hybrid |  |  |  |  |  |  |  |  |

## Q4 — Home onboarding mode-switch

| Mechanic | P1 | P2 | P3 | P4 | P5 | P6 | Sum | Tie-break note |
|---|---|---|---|---|---|---|---|---|
| (i) dismissible cards |  |  |  |  |  |  |  |  |
| (ii) state-driven reshape |  |  |  |  |  |  |  |  |
| (iii) progressive fade-out |  |  |  |  |  |  |  |  |

## Q5 — ⌘K scope

| Scope | P1 | P2 | P3 | P4 | P5 | P6 | Sum | Tie-break note |
|---|---|---|---|---|---|---|---|---|
| (a) navigation only |  |  |  |  |  |  |  |  |
| (b) navigation + actions |  |  |  |  |  |  |  |  |
| (c) navigation + actions + AI |  |  |  |  |  |  |  |  |

## Q6 — Mobile AI conversation

| Model | P1 | P2 | P3 | P4 | P5 | P6 | Sum | Tie-break note |
|---|---|---|---|---|---|---|---|---|
| (a) one persistent thread |  |  |  |  |  |  |  |  |
| (b) per-dataset threads |  |  |  |  |  |  |  |  |
| (c) ephemeral |  |  |  |  |  |  |  |  |
| (d) per-named-topic |  |  |  |  |  |  |  |  |

## Q7 — Field-type colour treatment

| Treatment | P1 | P2 | P3 | P4 | P5 | P6 | Sum | Tie-break note |
|---|---|---|---|---|---|---|---|---|
| (a) current semantic hues as tokens |  |  |  |  |  |  |  |  |
| (b) derived from chart tokens |  |  |  |  |  |  |  |  |
| (c) monochrome + icons |  |  |  |  |  |  |  |  |

## Q8 — Empty-state style + depth (4 cells per surface)

| Style+Depth combo | P1 | P2 | P3 | P4 | P5 | P6 | Sum | Tie-break note |
|---|---|---|---|---|---|---|---|---|
| Illustration + terse |  |  |  |  |  |  |  |  |
| Illustration + explanatory |  |  |  |  |  |  |  |  |
| Typographic + terse |  |  |  |  |  |  |  |  |
| Typographic + explanatory |  |  |  |  |  |  |  |  |

## Q9 — Power-user discoverability

| Approach | P1 | P2 | P3 | P4 | P5 | P6 | Sum | Tie-break note |
|---|---|---|---|---|---|---|---|---|
| (a) guided spotlight tour |  |  |  |  |  |  |  |  |
| (b) ambient JIT hints |  |  |  |  |  |  |  |  |
| (c) persistent learn card |  |  |  |  |  |  |  |  |
EOF
```

- [ ] **Step 2 (jointly with user):** Walk through each question's options, agree scores, fill the table. Don't compute sums until all rows are filled — sums are advisory only; principle priority is the actual tie-breaker.

- [ ] **Step 3 (agent):** Commit the scoring table.

```bash
git add docs/design-exploration/sub-project-11/convergence/scoring-table.md
cat > /tmp/commit-msg.txt << 'EOF'
docs(design): phase 3 scoring — phase 2 outputs against 6 principles

Score 0-3 per principle per option. Principle priority breaks ties.
EOF
git commit -F /tmp/commit-msg.txt
```

### Task 12: Decisions document — chosen direction per question

**Files:**
- Create: `docs/design-exploration/sub-project-11/convergence/decisions.md`

- [ ] **Step 1 (agent):** Build the decisions scaffold.

```bash
cat > docs/design-exploration/sub-project-11/convergence/decisions.md << 'EOF'
# Phase 3 decisions — chosen design direction per question

For each question: chosen option + 1-3 sentences of rationale grounded in
the principles + any caveats / variants kept open for sub-project 12 to
explore at implementation time.

---

## Q1 — Ambient AI on /analytics
**Chosen:** (a/b/c — fill in)
**Rationale:**
**Caveats / open at impl time:**

## Q2 — Query Builder morph
**Chosen:**
**Rationale:**
**Caveats:**

## Q3 — Multi-result layout
**Chosen:**
**Rationale:**
**Caveats:**

## Q4 — Home onboarding mode-switch
**Chosen:**
**Rationale:**
**Caveats:**

## Q5 — ⌘K scope
**Chosen:**
**Rationale:**
**Caveats:**

## Q6 — Mobile AI conversation
**Chosen:**
**Rationale:**
**Caveats:**

## Q7 — Field-type colour treatment
**Chosen:**
**Rationale:**
**Caveats:**

## Q8 — Empty-state style + depth
**Chosen style:**
**Chosen depth:**
**Rationale:**
**Caveats:**

## Q9 — Power-user discoverability
**Chosen:**
**Rationale:**
**Caveats:**
EOF
```

- [ ] **Step 2 (jointly with user):** Fill in chosen direction + rationale + caveats per question. Cross-reference the scoring table — any decision that contradicts the scoring should explain why (e.g., "scored lower on P4 but the P3 win matters more for adoption").

- [ ] **Step 3 (agent):** Commit decisions.

```bash
git add docs/design-exploration/sub-project-11/convergence/decisions.md
cat > /tmp/commit-msg.txt << 'EOF'
docs(design): phase 3 decisions — chosen direction per load-bearing question
EOF
git commit -F /tmp/commit-msg.txt
```

### Task 13: Cross-question consistency check

Decisions made independently per question can produce contradictions when stacked. Catch and resolve before Phase 4.

**Files:**
- Create: `docs/design-exploration/sub-project-11/convergence/consistency-check.md`

- [ ] **Step 1 (agent):** Build the consistency-check scaffold with the known potential contradictions.

```bash
cat > docs/design-exploration/sub-project-11/convergence/consistency-check.md << 'EOF'
# Phase 3 cross-question consistency check

Known potential contradictions across decisions, each requiring an
explicit resolution before Phase 4.

---

## C1 — AI invocation paths must agree (Q1 ↔ Q5)

**Question:** If Q1 picks an ambient AI shape (right panel / ⌘K modal / inline) AND Q5 picks a ⌘K scope that includes AI, does the user have one canonical "open AI" path or multiple? If multiple, are they discoverable?

**Resolution:**

## C2 — Multi-result layout must accommodate ambient AI (Q3 ↔ Q1)

**Question:** If Q3 picks canvas (draggable panels) and Q1 picks right-side panel, the right panel competes for the same screen real estate as the canvas. If Q3 picks notebook (stacked cells), each cell needs to know whether AI was involved in producing it.

**Resolution:**

## C3 — Mobile AI conversation model must reconcile with desktop ambient AI (Q6 ↔ Q1)

**Question:** Does the mobile global thread (Q6) share state with desktop ambient AI (Q1)? If yes, the desktop ambient surface needs the same persistence model. If no, mobile and desktop AI feel like different products.

**Resolution:**

## C4 — Empty-state pattern must work for /home onboarding (Q8 ↔ Q4)

**Question:** The chosen empty-state style + depth (Q8) is the building block for /home's teaching mode (Q4). Are they consistent — i.e., does the home page's teaching cards use the same illustration/typography decision and the same depth?

**Resolution:**

## C5 — Discoverability mechanism must respect chosen onboarding mode (Q9 ↔ Q4)

**Question:** If Q4 picks state-driven reshape (no explicit user dismiss), can Q9's discoverability mechanism (e.g., spotlight tour) plausibly co-exist? Spotlight tours require explicit dismissal. Mismatch produces a layered onboarding experience.

**Resolution:**

## C6 — Field-type colour treatment must work across multi-result layout (Q7 ↔ Q3)

**Question:** If Q3 picks canvas and Q7 picks (b) chart-derived colours, multiple panels with different field types might use *similar* palette colours, causing chart-vs-field confusion. If Q7 picks (c) monochrome, the field tree readability at the canvas edge needs verification.

**Resolution:**

---

## Other contradictions surfaced during review

(add as found)
EOF
```

- [ ] **Step 2 (jointly with user):** Walk through each contradiction. Resolve each by either (a) ratifying the existing decisions and noting how they coexist, or (b) revisiting one decision and updating `decisions.md`.

- [ ] **Step 3 (agent):** If `decisions.md` was updated in Step 2, amend its commit (acceptable since not pushed yet) OR create a new commit explaining the change.

```bash
# If decisions.md changed:
git add docs/design-exploration/sub-project-11/convergence/decisions.md docs/design-exploration/sub-project-11/convergence/consistency-check.md
cat > /tmp/commit-msg.txt << 'EOF'
docs(design): phase 3 consistency check + decision updates

Cross-question contradictions surfaced and resolved.
Updated decisions.md where conflicts required revisiting choices.
EOF
git commit -F /tmp/commit-msg.txt
```

```bash
# If only consistency-check.md is new:
git add docs/design-exploration/sub-project-11/convergence/consistency-check.md
cat > /tmp/commit-msg.txt << 'EOF'
docs(design): phase 3 cross-question consistency check

All known potential contradictions between Q1-Q9 decisions resolved.
EOF
git commit -F /tmp/commit-msg.txt
```

### Task 14: Phase 3 close-out

- [ ] **Step 1 (agent):** Mark Phase 3 complete.

```bash
cat > docs/design-exploration/sub-project-11/convergence/PHASE-3-COMPLETE.md << 'EOF'
# Phase 3 (convergence) — Closed

- scoring-table.md: filled
- decisions.md: filled, one direction chosen per question
- consistency-check.md: all known contradictions resolved

## Ready for Phase 4 (change-list spec)
EOF
git add docs/design-exploration/sub-project-11/convergence/PHASE-3-COMPLETE.md
cat > /tmp/commit-msg.txt << 'EOF'
docs(design): phase 3 complete — convergence closed
EOF
git commit -F /tmp/commit-msg.txt
```

---

## Phase 4: write the change-list spec

One task. Translate the convergence decisions into a structured spec that drives sub-project 12 implementation.

### Task 15: Write the redesign change-list spec

**Files:**
- Create: `docs/superpowers/specs/2026-XX-XX-design-redesign-change-list-design.md` (replace `XX-XX` with the actual date the agent runs this task)

**Source material to consult while writing:**
- `docs/superpowers/specs/2026-04-23-design-review-surface-audit-design.md` — the audit spec (principles, postures, questions)
- `docs/design-exploration/sub-project-11/convergence/decisions.md` — chosen direction per question
- `docs/design-exploration/sub-project-11/convergence/consistency-check.md` — resolved contradictions
- All `q*/notes.md` files — captured rationale per option
- All `q*/previews/` PNGs — visual reference for what was chosen

- [ ] **Step 1 (agent):** Determine today's date and the spec filename.

```bash
date +%Y-%m-%d
# Use the output as the prefix
```

- [ ] **Step 2 (agent):** Build the spec scaffold. The structure is the *change list* — what concretely changes vs. the current product, organised by surface.

```markdown
# Eggscaliber-Lite Redesign — Change-List Spec (Sub-project 11 → 12 handoff)

**Date:** YYYY-MM-DD
**Sub-project:** 11 (this spec) → drives 12 (Design System V2 & Mobile)
**Source decisions:** `docs/design-exploration/sub-project-11/convergence/decisions.md`
**Source spec:** `docs/superpowers/specs/2026-04-23-design-review-surface-audit-design.md`

## Purpose

This spec is the change list that drives sub-project 12 implementation.
It says: for each surface, what is kept, what is refined, what is rethought,
what is relocated, what is added. Each entry is concrete enough that
sub-project 12's implementation plan can be written against it without
re-litigating the design.

## Principles (carried forward from audit spec, unchanged)

1. AI is a capability, not a destination
2. Honest about loading, empty, and failure
3. Friendly to onboard, restrained to disappear
4. Data density over decoration
5. Navigation reflects frequency; investment reflects importance
6. Keyboard is first-class, not a courtesy

## Resolved decisions (carried forward from convergence)

(For each Q1-Q9: one sentence on the chosen direction, link to per-question
notes and previews. This is a quick-reference; full rationale lives in
decisions.md.)

## Change list — by surface

For each surface (drawing on the per-surface postures in the audit spec):

### / (unauth marketing home)
**Keep / Change:**
- Keep:
- Change:
- Add:
- Remove:

### /home (NEW route — authed workspace + onboarding gateway)
**Keep / Change / Add / Remove:**
**Mode-switch mechanic:** (per Q4 decision)
**Onboarding teaching cards:** (per Q8 + Q4 decisions)
**Power-user discoverability:** (per Q9 decision)

### /datasets
**Keep / Change / Add / Remove:**
**View action target:** (per /datasets/[id] posture)

### /datasets/[id]
**Keep / Change / Add / Remove:**
**Content shape:** (per surface posture; either redirect or pre-filtered analytics)

### /datasets/upload (wizard)
**Keep / Change / Add / Remove:**
**Step count + collapse strategy:**

### /analytics — the centre of gravity
**Keep / Change / Add / Remove:**
**Ambient AI integration:** (per Q1)
**Query Builder morph behaviour:** (per Q2)
**Multi-result layout:** (per Q3)
**Field-type colour treatment:** (per Q7)
**Empty + loading state pattern:** (per Q8 cross-cutting)

### /ai (kept as route, content reshaped)
**Desktop:** (per Q1)
**Mobile (Tier 1 primary surface):** (per Q6)
**Conversation model:** (per Q6)

### /account
**Clerk widget:** Keep (hard constraint)
**API Tokens:** Relocate + invest — (specifically: Clerk custom page or new sub-route)
**Invest details:** (concrete deliverables — Claude Desktop snippet, Code snippet, success state, error state)

### /admin
**Nav placement:** Move to user menu dropdown
**Surface investment:** (concrete deliverables — empty states, seeded-data dev path, keyboard nav)

### /org/groups
**Nav placement:** Move under "Organisation" menu in org switcher (preferably Clerk OrganizationProfile custom page)
**Surface investment:** (concrete deliverables)

### Sign-in / Sign-up (Clerk)
**Posture:** Keep. Optional: brand frame via Clerk appearance API.

## Cross-cutting changes

### Top nav
**Before:** Datasets · Analytics · AI + theme + org switcher + user menu
**After:** Datasets · Analytics + ⌘K + theme + org switcher + user menu
**Mobile:** AI primary entry; everything else behind menu
**"No organisation selected" badge:** Replace with onboarding nudge OR remove

### ⌘K command palette
**Scope:** (per Q5)
**Surfaces it operates on:** (concrete list)
**AI invocation pattern:** (per Q1 + Q5 consistency resolution)

### Empty-state pattern
**Style:** (per Q8)
**Depth:** (per Q8)
**Token-driven implementation hint:** (any required additions to design tokens)

### Loading states
**Skeleton convention:** (per cross-cutting audit posture — likely shadcn Skeleton component, applied at panel level)

### Density tiers
**Tier 1 — data surface:** spacing tokens (specify)
**Tier 2 — transactional surface:** spacing tokens (specify)
**Tier 3 — marketing surface:** spacing tokens (specify)

### Motion tokens
**micro:** (specify duration + easing)
**macro:** (specify)
**enter:** (specify)

### Mobile gates
**Tier 3 surfaces (upload, metadata, query building, admin, org settings):** add mobile gate component that displays "desktop required" with explanatory copy + light marketing of the AI mobile experience as a fallback
**Tier 2 surfaces (read-only analyses):** ensure responsive layout; document the read-only constraint
**Tier 1 (mobile AI):** dedicated mobile layout per Q6 decision

## Deliverables for sub-project 12

The implementation plan for sub-project 12 should produce:

1. New tokens / changed tokens (`apps/web/src/lib/theme.ts` and `theme.config.ts`)
2. New `/home` route + workspace + teaching components
3. `/analytics` rebuild (ambient AI, mode-adaptive Query Builder, multi-result layout)
4. `/ai` desktop + mobile reshape; mobile-first AI surface
5. `/datasets/[id]` content reshape (likely redirect or pre-filtered analytics)
6. ⌘K command palette implementation (likely cmdk library or kbar)
7. Empty-state component family (canonical pattern, retrofitted across all surfaces)
8. Loading skeleton convention (panel-level)
9. Motion tokens + Tailwind config additions
10. Mobile gate component (Tier 3 surfaces)
11. Top nav refactor (drop /ai link, add ⌘K button, replace "No org" badge)
12. Account API Tokens promotion (Clerk custom page or new route)
13. Org groups relocation (Clerk OrganizationProfile custom page)
14. Admin nav relocation + investment (empty states, seeded data, keyboard)
15. Storybook stories for every new/changed component

Sub-project 12 will produce its own implementation plan against this change list.

## Out of scope for sub-project 12 (deferred)

(List any items from the change list that are intentionally pushed to
later sub-projects, with a one-line reason each.)

## Open questions for sub-project 12 implementation phase

(List any questions the design intentionally left to implementation time —
e.g., "exact `cmdk` library or build our own", "saved-queries schema shape",
"persistence model for AI conversation".)
```

- [ ] **Step 3 (agent + jointly with user):** Fill in the scaffold using the per-question decisions, the per-surface postures from the audit spec, and visual reference from previews. Where a decision was deferred to sub-project 12 (e.g., implementation library choice), put it in the "Open questions" section explicitly.

- [ ] **Step 4 (agent):** Self-review the change-list spec.

  - **Coverage:** Does every per-surface posture from the audit spec appear in the change list? Does every Q1-Q9 decision appear?
  - **Concreteness:** Is every "Change:" entry actionable enough to write a sub-project 12 task against, or is it still a design question?
  - **Cross-references:** Every chosen direction must link back to the relevant `qN/notes.md` and `convergence/decisions.md` so reviewers can trace why.
  - **Placeholder scan:** No TBD/TODO; either fill in or move to Open Questions section.

  Fix issues inline.

- [ ] **Step 5 (jointly with user):** User reads the spec, requests changes, agent makes them.

- [ ] **Step 6 (agent):** Once approved, commit.

```bash
SPEC_FILE=$(ls docs/superpowers/specs/2026-*-design-redesign-change-list-design.md | tail -1)
git add "$SPEC_FILE"
cat > /tmp/commit-msg.txt << 'EOF'
docs: sub-project 11 phase 4 — design redesign change-list spec

Translates phase 3 convergence decisions into a per-surface change list
that drives sub-project 12 implementation. Lists 15 deliverables for
sub-project 12, with explicit cross-references to per-question rationale
and visual previews from phase 2.

This spec closes sub-project 11.
EOF
git commit -F /tmp/commit-msg.txt
```

### Task 16: Mark sub-project 11 complete on the roadmap

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1 (agent):** Update the roadmap table — change Sub-project 11 status from 🔜 to ✅, link both spec + plan, change Sub-project 12 status from ⏳ to 🔜.

Find the current state:

```bash
grep -nE "^\| 11 \||^\| 12 \|" docs/ROADMAP.md
```

Replace lines (use Edit tool with the captured strings, not literal here — actual current strings come from the grep output):

```
| 11 | Design Review & Redesign | ✅ Complete | [audit](superpowers/specs/2026-04-23-design-review-surface-audit-design.md) + [change list](superpowers/specs/<date>-design-redesign-change-list-design.md) | [plan](superpowers/plans/2026-04-23-design-review-redesign.md) |
| 12 | Design System V2 & Mobile | 🔜 Next | — | — |
```

(Adjust spec filename + date in the path to match what was actually produced in Task 15.)

- [ ] **Step 2 (agent):** Update the per-section sub-project 11 entry under "Sub-project Summaries" — change status emoji and add a final paragraph naming the chosen-direction summary.

- [ ] **Step 3 (agent):** Commit roadmap update.

```bash
git add docs/ROADMAP.md
cat > /tmp/commit-msg.txt << 'EOF'
docs: mark sub-project 11 complete; promote sub-project 12 to next

Audit spec + change-list spec linked. Phase 1-4 deliverables landed.
Sub-project 12 (Design System V2 & Mobile) inherits the change list as
its driving spec.
EOF
git commit -F /tmp/commit-msg.txt
```

### Task 17: Close-out + handoff to sub-project 12

- [ ] **Step 1 (agent):** Confirm all artefacts exist:

```bash
echo "=== Audit spec ==="
ls -la docs/superpowers/specs/2026-04-23-design-review-surface-audit-design.md
echo "=== Change-list spec ==="
ls -la docs/superpowers/specs/*-design-redesign-change-list-design.md
echo "=== This plan ==="
ls -la docs/superpowers/plans/2026-04-23-design-review-redesign.md
echo "=== Per-question artefacts ==="
ls docs/design-exploration/sub-project-11/q*/
echo "=== Convergence artefacts ==="
ls docs/design-exploration/sub-project-11/convergence/
echo "=== Roadmap status ==="
grep -E "^\| 11 \||^\| 12 \|" docs/ROADMAP.md
```

Expected: all exist; roadmap shows 11 ✅ and 12 🔜.

- [ ] **Step 2 (agent):** Sub-project 11 is closed. Tell the user.

> Sub-project 11 (Design Review & Redesign) complete. Audit spec, exploration artefacts, convergence decisions, and the change-list spec are all committed. Sub-project 12 (Design System V2 & Mobile) is next — its implementation plan should be written against the change-list spec.

---

## Self-review

**1. Spec coverage:** every requirement from the source spec has a task?
- 9 load-bearing questions → 9 Phase 2 tasks (Tasks 1–9): ✓
- Phase 2 success criteria → Task 10 review checkpoint: ✓
- Convergence (decisions per principle, by priority) → Task 11 (scoring) + Task 12 (decisions): ✓
- Cross-question consistency → Task 13: ✓
- Final change-list spec → Task 15: ✓
- Roadmap update → Task 16: ✓
- Hard constraints (no production code, Clerk-owned untouched, dark parity, raw-color check) → enforced via per-task verification grep + Task 15 carries them through to sub-project 12 deliverables: ✓
- Architecture stress-test notes from spec appendix → carried forward as "Open questions for sub-project 12 implementation phase" in Task 15 scaffold: ✓

**2. Placeholder scan:** no TBD / TODO / "implement later" / "similar to Task N" anywhere — every task has its own concrete prompt + scaffold + commands. ✓

**3. Type consistency:** N/A — no code in this plan.

**4. Patterns compliance (`docs/patterns/backend.md` and `frontend.md`):** N/A — no code produced. The change-list spec (Task 15) generates *concrete deliverables* for sub-project 12; *that* sub-project's implementation plan will be the one that has to comply with patterns.md.

**One adaptation noted:** the standard plan template assumes TDD (write failing test → implement → commit). This plan doesn't follow that shape because no code is produced. Instead each task follows: prepare prompt → user generates in Claude Design → agent verifies + extracts + commits. The "frequent commits" + "exact paths" + "exact commands" discipline is preserved.
