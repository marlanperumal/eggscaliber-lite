---
name: review-pr-comments
description: Use when a PR has unresolved bot review comments (e.g. gemini-code-review) — fetches comments, evaluates each, implements valid suggestions (including scanning for similar latent issues), declines others with a reply, then re-requests review and repeats until satisfied.
---

# Review PR Bot Comments

## Overview

Iterative loop: fetch bot review comments → evaluate each → implement or decline → re-request review → repeat until no open comments remain.

**Tools required:** GitHub MCP (`get_pull_request_comments`, `add_issue_comment`, `get_pull_request_files`, `get_file_contents`), file read/edit tools, git bash.

---

## Step 1: Identify the PR

If the PR number was not provided, ask. Confirm the repo owner and name from the current working directory's git remote.

```
owner: marlanperumal
repo: eggscaliber-lite
pr_number: <from context>
```

---

## Step 2: Fetch all review comments

Use `get_pull_request_comments` to retrieve inline review comments. Also use `get_pull_request_reviews` to check for general review-level comments.

Filter to comments from bot accounts (usernames ending in `[bot]` or known bots like `gemini-code-review[bot]`). Ignore comments that are already resolved or that you have already replied to in this session.

Group comments by file so related suggestions can be evaluated together.

---

## Step 3: Read the affected code

For each comment, use `get_file_contents` or the local Read tool to read the full context around the flagged line — at minimum 20 lines above and below. Do not evaluate a suggestion without reading the actual code.

---

## Step 4: Evaluate each comment

Apply this decision rubric:

| Criterion | Implement | Decline |
|---|---|---|
| Correctness — actual bug or logic error | ✅ | |
| Security — real vulnerability (injection, auth bypass, data leak) | ✅ | |
| Robustness — missing error handling at a system boundary | ✅ | |
| Style/convention — conflicts with project patterns in `docs/patterns/` | ✅ | |
| Style/convention — consistent with existing code, bot preference differs | | ✅ |
| Performance — meaningful improvement with clear evidence | ✅ | |
| Performance — micro-optimisation with negligible impact | | ✅ |
| Speculative — "you might want to" / "consider adding" for hypothetical future | | ✅ |
| Duplicate of a change already made this session | | ✅ |

When in doubt, implement. Bot reviewers have seen the full diff; treat their concerns as a second set of eyes, not noise.

---

## Step 5a: If implementing

1. Read the full file.
2. Make the minimal change that addresses the concern.
3. **Scan for similar latent issues:** grep the codebase for the same pattern in other files. Apply the same fix where found. List every file changed.
4. Commit with a conventional commit message referencing the concern.
5. Do **not** reply to the comment on GitHub — a commit addressing it is sufficient.

---

## Step 5b: If declining

Reply directly to the comment on GitHub using `add_issue_comment` (or the review comment reply endpoint if available). The reply must:
- Acknowledge the suggestion politely.
- Explain specifically why it does not apply to this codebase (project convention, intentional design, out of scope).
- Be one to three sentences — no fluff.

Example:

> Thanks for the suggestion. We intentionally omit this check here because `get_session` already guarantees a valid connection via the SQLModel dependency — adding a null guard would be defensive coding against an impossible state.

---

## Step 6: After all comments addressed

1. Push all commits: `git push origin <branch>`.
2. If the bot supports re-review requests, use `create_pull_request_review` to post a top-level comment: "All review comments addressed. Please re-review."
3. Otherwise, add an `add_issue_comment` to the PR: "Addressed all bot review comments — see commits above. Ready for re-review."

---

## Step 7: Wait and repeat

After pushing, wait for the bot to post new comments (typically within a few minutes of the CI run completing). When prompted by the user, return to Step 2 and process any new comments.

Continue until:
- No new comments are posted after a re-review, **or**
- The user explicitly approves the PR as-is.

---

## What this skill does NOT do

- Does not merge the PR.
- Does not approve the PR on behalf of a human reviewer.
- Does not implement suggestions that introduce scope creep beyond the PR's stated purpose.
- Does not chase 100% bot satisfaction — if a suggestion is declined with a good reason, that is a valid resolution.
