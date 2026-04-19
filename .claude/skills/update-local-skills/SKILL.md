---
name: update-local-skills
description: Use when the superpowers plugin has updated and you want to merge upstream improvements into locally-overridden skills without losing project-specific customisations
---

# Update Local Skills

## Overview

Local skills in `.claude/skills/` override plugin skills of the same name. When the plugin updates, upstream improvements don't flow through automatically. This skill merges upstream changes into local copies while preserving project-specific additions, and flags conflicts for human resolution.

## When to Use

- After a superpowers plugin update (`~/.claude/plugins/cache/claude-plugins-official/superpowers/*/`)
- When you notice a local skill is significantly behind upstream
- Periodically as maintenance

## Plugin Cache Location

```
~/.claude/plugins/cache/claude-plugins-official/superpowers/<version>/skills/
```

The version directory changes on update. Always use the latest version directory.

## Process

### Step 1: Identify locally-overridden skills

List skills in `.claude/skills/` that share a name with a plugin skill:

```bash
ls .claude/skills/
ls ~/.claude/plugins/cache/claude-plugins-official/superpowers/
# Find latest version, then:
ls ~/.claude/plugins/cache/claude-plugins-official/superpowers/<version>/skills/
```

For each match, proceed to Step 2.

### Step 2: For each overridden skill — diff upstream vs local

Read both versions in full. Then identify three categories:

| Category | Definition | Action |
|----------|-----------|--------|
| **Local-only** | Content in local but not upstream | Keep — these are our customisations |
| **Upstream-only** | Content in upstream but not local | Evaluate — integrate if valuable |
| **Conflicting** | Same section exists in both but with different content | Ask the user |

**Evaluating upstream-only changes:**
- New sections, expanded explanations, additional examples → integrate
- Wording fixes, clarity improvements → integrate
- Process steps that contradict local customisations → this is a conflict — ask
- Content that duplicates what local already says differently → this is a conflict — ask

### Step 3: Resolve conflicts with the user

For each conflict, present:

```
CONFLICT in <skill-name>:

LOCAL version says:
  "<exact local text>"

UPSTREAM version says:
  "<exact upstream text>"

Options:
  A) Keep local
  B) Use upstream
  C) Merge both (describe how)
  D) Show me both in full context first
```

Wait for a decision before proceeding. Do not guess or pick a default.

### Step 4: Write the merged skill

Apply all decisions:
- Keep all local-only content
- Add integrated upstream-only content in the appropriate section
- Apply conflict resolutions

Write the merged file back to `.claude/skills/<skill-name>/SKILL.md`.

### Step 5: Copy any new supporting files

If the upstream skill directory has supporting files (e.g. prompt templates) that don't exist locally, copy them:

```bash
cp ~/.claude/plugins/cache/.../skills/<name>/<new-file> .claude/skills/<name>/
```

Don't overwrite existing local supporting files without checking for conflicts first.

### Step 6: Commit

```bash
git add .claude/skills/<skill-name>/
```

Write commit message to `/tmp/commit-msg.txt`:
```
chore(skills): merge upstream <skill-name> improvements — preserve local customisations
```

```bash
git commit -F /tmp/commit-msg.txt
```

## What counts as a local customisation in this project

The following additions are project-specific and must always be preserved:

**`writing-plans` — Self-Review step 4:**
> Patterns compliance — checks every code snippet against `docs/patterns/backend.md` and `docs/patterns/frontend.md` for `response_model=`, typed service returns, no `**kwargs`, no `as any`.

**`subagent-driven-development` — pre-finish gates:**
> `audit-patterns` and `audit-tests` are required steps between the final code review and `finishing-a-development-branch`.

**`executing-plans` — Step 3 Pre-Completion Audits:**
> `audit-patterns`, `audit-tests`, and `audit-functionality` are required before `finishing-a-development-branch`.

If upstream changes touch any of these areas, treat them as conflicts and ask.

## Red Flags — Stop and Ask

- Upstream removed a section that local depends on
- Upstream restructured the process flow in a way that would displace local gates
- Upstream renamed a step or skill reference that local customisations reference
- You're unsure whether an upstream change is compatible with a local one

When in doubt, present it as a conflict rather than guessing.
