---
name: review-pr-comments
description: Use when a PR has unresolved bot review comments (e.g.
  gemini-code-assist, gemini-code-review, copilot) that need to be triaged —
  deciding what to implement, what to decline, and when to re-request review.
---

# Review PR Bot Comments

## Overview

Fetch bot review comments → evaluate each against the rubric → implement or
decline → push → re-request review → repeat until satisfied.

**Tools:** GitHub MCP (`get_pull_request_comments`, `get_pull_request_reviews`,
`add_issue_comment`), Read/Edit, git bash.

---

## Step 1: Identify the PR

Confirm `owner`, `repo`, and `pull_number` from context or ask.

---

## Step 2: Fetch comments

Call `get_pull_request_comments` and `get_pull_request_reviews`.

Filter to bot accounts (usernames ending in `[bot]`). Skip any comment you
have already replied to or addressed this session. Group by file.

---

## Step 3: Read the affected code

For each comment, read at least 20 lines above and below the flagged line
before forming any opinion. Do not evaluate without reading the actual code.

---

## Step 4: Evaluate — implement or decline?

| Criterion | Decision |
| --- | --- |
| Actual bug or logic error | Implement |
| Security vulnerability (injection, auth bypass, data leak) | Implement |
| Missing error handling at a system boundary | Implement |
| Violates project patterns in `docs/patterns/` | Implement |
| Consistent with existing code; bot preference just differs | Decline |
| Meaningful performance improvement with evidence | Implement |
| Micro-optimisation with negligible real impact | Decline |
| Speculative — "consider adding" for a hypothetical future | Decline |
| Already fixed by another change this session | Decline |

When in doubt, implement. Bot reviewers have seen the full diff.

---

## Step 5a: Implementing

1. Read the full file.
2. Make the minimal change that addresses the concern.
3. **Scan for similar latent issues:** grep the codebase for the same pattern
   in other files. Apply the fix wherever found. List every file changed.
4. Commit with a conventional commit message (`fix(scope): ...`).
5. Do **not** reply on GitHub — the commit is the response.

---

## Step 5b: Declining

Reply to the comment via `add_issue_comment`. The reply must:

- Acknowledge the suggestion.
- Explain in 1–3 sentences why it does not apply (project convention,
  intentional design, impossible state, out of scope).

Example:

> Thanks for the flag. We omit this null check because `get_session` is a
> SQLModel dependency that already guarantees a valid connection — guarding
> against it would be defensive coding against an impossible state.

---

## Step 6: Push and notify

```bash
git push origin <branch>
```

Then post to the PR via `add_issue_comment`:

> All bot review comments addressed — see commits above. Ready for re-review.

---

## Step 7: Repeat

When the user says the bot has re-reviewed, return to Step 2 and process any
new comments.

Stop when:

- No new comments after a re-review, **or**
- The user explicitly signs off.

---

## What this skill does NOT do

- Does not merge or approve the PR.
- Does not implement suggestions that introduce scope creep.
- Does not chase 100% bot satisfaction — a reasoned decline is a valid outcome.
