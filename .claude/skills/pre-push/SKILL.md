---
name: pre-push
description: Use before pushing to master, or whenever you want to verify the branch is ready to push. Runs the full local quality gate in order, pauses on each failure, and only signals "ready to push" once every check is green.
---

# Pre-push

## Overview

A deliberate, step-by-step run of the local quality gate that mirrors the CI pipeline. The `.claude/hooks/pre-push-check.sh` hook enforces a subset of these automatically on `git push`, but this skill is the canonical full-suite check and should be run explicitly when you (or the user) want confidence before pushing — especially before tier-1 merges, after large refactors, or after pulling in dep updates.

The skill is **rigid**: run the steps in order, do not batch, paste real command output for each step, do not skip ahead on green.

---

## Step 1 — Confirm clean working tree

Run `git status`. If there are unstaged or uncommitted changes that aren't intentional WIP, stop and surface them to the user before proceeding. The gate runs against the working tree, so dirty state will mask problems on the commit you actually push.

## Step 2 — Lint

```bash
just lint
```

Paste the final lines of output. On failure: stop, fix, re-run. Do not move to step 3 until this is green.

## Step 3 — Format check

```bash
just format-check
```

Paste output. On failure: `just format` to fix, then re-run `just format-check`. Do not auto-commit format changes silently — surface them so the user sees what shifted.

## Step 4 — Typecheck

```bash
just typecheck
```

Paste output. Type errors often hide in files you didn't touch (cascading from a shared type change). Read the error before guessing a fix.

## Step 5 — Tests

```bash
just test
```

Paste the summary line (passed / failed / skipped counts) and any failure details. Never claim "tests pass" from a summary alone — confirm the exit code was 0.

## Step 6 — Storybook build (only if Storybook-relevant code changed)

```bash
just build-storybook
```

Run this when you've touched: `apps/web/**/*.stories.tsx`, `apps/web/.storybook/**`, design tokens, shared components used in stories, or anything that could break the build. Skip when the change is API-only / docs-only.

## Step 7 — Report

Tell the user: each step's status (`✓ passed` / `✗ failed`), what was fixed during the run, and explicit confirmation that the branch is ready to push. If any step required a fix, suggest a fresh commit covering the fix.

---

## Anti-patterns

- **Do not chain steps with `&&`** when running this skill — failures upstream get buried and you lose per-step output.
- **Do not summarise output** — paste the real tail. The point of the skill is verification, not narration.
- **Do not skip a step** because "the hook covers it" — the hook is a safety net for `git push`, this skill is the proactive check.
- **Do not bypass the hook with `SKIP_PRE_PUSH=1`** after running this skill green — if you ran the skill, the hook will pass too, and the bypass flag is for deliberate WIP-only pushes.
