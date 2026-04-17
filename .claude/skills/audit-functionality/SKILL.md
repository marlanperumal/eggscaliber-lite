---
name: audit-functionality
description: Use when you have a spec, plan, or feature document and want to verify the implementation actually delivers what was specified — especially after a build phase, before marking a sub-project complete, or when something feels "done on paper but broken in practice."
---

# Audit Functionality

## Overview

Systematically walk every requirement in a spec and verify it works in the real codebase — not "the code exists", but "the code does what the spec says." Output a gap report and optionally generate a gap-fill plan.

---

## Step 1: Locate the spec

Ask the user if they haven't pointed you at one. Valid sources:
- A plan file (`docs/superpowers/plans/*.md`)
- A roadmap or sub-project spec (`docs/ROADMAP.md`, `docs/specs/`)
- A Linear issue or Confluence page

Read it fully before doing anything else.

---

## Step 2: Extract requirements

Skim the spec and produce a flat checklist of discrete, verifiable behaviours. Each item should be specific enough that you can answer "yes" or "no" by reading code.

**Good:** "Step 2 shows a confidence badge (amber for 'review', green for 'high')"  
**Bad:** "Step 2 is improved"

If the spec has explicit task lists (checkboxes), start there. Expand vague items into testable sub-items.

---

## Step 3: Audit each requirement

For each item, do at least one of:

| Evidence type | When to use |
|---|---|
| Read the component/route file | UI behaviour, API shape |
| Grep for the relevant identifier | Confirm it exists and is wired up |
| Read the test file | Verify there's a test that exercises it |
| Read the Storybook story | Confirm the UI state is reachable |

**Rules:**
- Never mark something as ✅ because it "probably works" or "was in the plan". Verify it.
- If a file doesn't exist, the feature doesn't exist. No assumptions.
- If the code exists but the spec says it should do X and the code does Y, that's a gap.

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

- Does not run the app or execute tests — it audits by reading code
- Does not audit test coverage comprehensively — use a dedicated test audit for that
- Does not re-audit items already marked ✅ unless the user asks

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Marking ✅ because the task was in a completed plan | The plan was the intention. Verify the code. |
| Grepping for a function name and calling it done | Read the call site — is it actually invoked correctly? |
| Auditing only the frontend or only the backend | A feature needs both ends. Check each layer. |
| Skipping Storybook stories | Stories reveal whether UI states are actually reachable |
