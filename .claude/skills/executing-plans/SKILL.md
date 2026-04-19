---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** Tell your human partner that Superpowers works much better with access to subagents. The quality of its work will be significantly higher if run on a platform with subagent support (such as Claude Code or Codex). If subagents are available, use superpowers:subagent-driven-development instead of this skill.

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Tasks

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Pre-Completion Audits

After all tasks complete and verified, run these audits in order before finishing:

1. **audit-patterns** — catches patterns violations (missing `response_model=`, bare `dict` returns, `**kwargs` in repos, `as any` casts) that inline execution doesn't catch per-task
2. **audit-tests** — catches test coverage gaps in high-risk code paths
3. **audit-functionality** — verifies the full implementation matches the plan/spec end-to-end (no per-task spec reviewer in this workflow)

Fix any issues surfaced before proceeding.

### Step 4: Complete Development

After audits pass:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent
- Never skip the Step 3 audits — audit-patterns, audit-tests, and audit-functionality are all required before finishing

## Integration

**Required workflow skills:**
- **superpowers:using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
- **superpowers:writing-plans** - Creates the plan this skill executes
- **audit-patterns** - REQUIRED: Step 3 audit before finishing
- **audit-tests** - REQUIRED: Step 3 audit before finishing
- **audit-functionality** - REQUIRED: Step 3 audit before finishing
- **superpowers:finishing-a-development-branch** - Complete development after all tasks
