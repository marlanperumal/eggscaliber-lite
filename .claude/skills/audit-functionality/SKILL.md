---
name: audit-functionality
description: Use when you have a spec, plan, or feature document and want to verify the implementation actually delivers what was specified — especially after a build phase, before marking a sub-project complete, or when something feels "done on paper but broken in practice."
---

# Audit Functionality

## Overview

Systematically walk every requirement in a spec and verify it works in the real codebase — not "the code exists", but "the code does what the spec says." Output a gap report and optionally generate a gap-fill plan.

---

## Step 1: Locate the spec

**Always use the original design spec, not an implementation plan.** Plans describe intended changes; specs describe required behaviour. If you're given a plan, trace it back to the spec it was derived from.

Valid sources (in priority order):
- Design spec (`docs/superpowers/specs/*.md`) — **preferred**
- Roadmap (`docs/ROADMAP.md`, `docs/specs/`)
- A Linear issue or Confluence page
- An implementation plan (`docs/superpowers/plans/*.md`) — only when no spec exists

Read it fully before doing anything else.

---

## Step 2: Extract requirements

Skim the spec and produce a flat checklist of discrete, verifiable behaviours. Each item should be specific enough that you can answer "yes" or "no" by reading code.

**Good:** "Step 2 shows a confidence badge (amber for 'review', green for 'high')"  
**Bad:** "Step 2 is improved"

If the spec has explicit task lists (checkboxes), start there. Expand vague items into testable sub-items.

---

## Step 3: Audit each requirement

Use all available evidence. For each item, use at least one of:

| Evidence type | When to use |
|---|---|
| **Live browser** (Playwright MCP) | UI behaviour, layout, visible state, interactions |
| **Live API call** (`curl`) | Endpoint shape, response fields, status codes |
| **Storybook** (navigate to story URL) | Edge-case UI states, loading/empty/error states |
| Read the component/route file | Cross-check what code claims to do |
| Grep for the relevant identifier | Confirm wiring — call site must actually exist |
| Read the test file | Verify test exercises the right behaviour |

**For live verification:**
1. Check if dev servers are running (`curl http://localhost:8000/health` / `curl http://localhost:3000`)
2. Start them with `just dev` / `just api` / `just storybook` if not
3. Use Playwright MCP to navigate pages and take screenshots
4. Make real API calls and inspect response shapes

**Rules:**
- Never mark something as ✅ because it "probably works" or "was in the plan". Verify it.
- If a file doesn't exist, the feature doesn't exist. No assumptions.
- If the code exists but the spec says it should do X and the code does Y, that's a gap.
- Code-only verification is insufficient for UI requirements — always check in the browser.

---

## Step 4: Produce the gap report

Output a table:

| # | Requirement | Status | Evidence / Notes |
|---|---|---|---|
| 1 | Confidence badge on Step 2 | ✅ Done | `Step2FieldDetection.tsx:95` — amber/green badge |
| 2 | Reset-to-detected button | ✅ Done | `Step2FieldDetection.tsx:125` — shown when override set |
| 3 | Count badges on reconciliation tabs | ❌ Missing | No `/reconcile/counts` call in Step3 |
| 4 | Bulk confirm/reject on probable tab | ⚠️ Partial | UI exists, API call missing error handling |

Status key:
- ✅ **Done** — spec requirement fully met, evidence found
- ❌ **Missing** — no implementation found
- ⚠️ **Partial** — implementation exists but incomplete or incorrect

---

## Step 5: Decide next action

After presenting the report, offer:

1. **Create a gap-fill plan** — if there are ❌ or ⚠️ items, use `superpowers:writing-plans` to produce a targeted plan covering only the gaps
2. **Mark complete** — if everything is ✅, confirm the sub-project or feature is done
3. **Spot-fix inline** — if gaps are small (1–3 lines each), fix them directly without a separate plan

Let the user choose. Don't auto-proceed into implementation without confirmation.

---

## What this skill does NOT do

- Does not audit test coverage comprehensively — use a dedicated test audit for that
- Does not re-audit items already marked ✅ unless the user asks

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Auditing the plan instead of the spec | Plans describe intended changes. Specs describe required behaviour. Use the spec. |
| Marking ✅ because the task was in a completed plan | The plan was the intention. Verify the live app. |
| Code-only verification for UI requirements | Reading the component isn't enough. Load it in the browser. |
| Grepping for a function name and calling it done | Read the call site — is it actually invoked correctly? |
| Auditing only the frontend or only the backend | A feature needs both ends. Check each layer. |
| Skipping Storybook stories | Stories reveal whether edge-case UI states are actually reachable |
| Assuming writes persist without checking | Verify the DB session commits (get_session pattern, middleware, etc.) |
