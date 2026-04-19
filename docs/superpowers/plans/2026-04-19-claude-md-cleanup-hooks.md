# CLAUDE.md Cleanup + Compliance Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce recurring CLAUDE.md violations by (1) restructuring CLAUDE.md to surface critical rules prominently and (2) adding SessionStart and PreToolUse hooks that enforce them deterministically.

**Architecture:** Add a `## CRITICAL RULES` block at the top of CLAUDE.md. Create two hook scripts in `.claude/hooks/`. Wire them in a new `.claude/settings.json` (project-scoped, committed). The SessionStart hook injects critical rules into model context on every session start (survives compaction). The PreToolUse hook intercepts Bash calls and blocks `cd` into subdirectories.

**Tech Stack:** Bash hook scripts, Claude Code settings.json hooks API, CLAUDE.md markdown.

---

### Task 1: Add CRITICAL RULES section to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (top of file, after `# CLAUDE.md` heading)

The most-violated rules based on `/slap` history are: `cd` into subdirs, not using `just`, starting Bash with `#`, same-call git add+commit, subagents not reading CLAUDE.md, and manually editing api.d.ts.

- [ ] **Step 1: Insert CRITICAL RULES block**

Edit `CLAUDE.md` — insert the following immediately after the `# CLAUDE.md` heading (line 1), before the "This file provides..." paragraph:

```markdown
## CRITICAL RULES

These are enforced by hooks but check them yourself first:

1. **Always use `just <cmd>` from repo root** — never `cd` into a subdirectory; never invoke raw `uv run`, `pytest`, `pnpm` etc. directly when a `just` recipe exists. Run `just --list` to check.
2. **Never start a Bash call with a `#` comment** — blocks auto-approval.
3. **`git add` and `git commit` must be separate Bash calls** — write message to `/tmp/commit-msg.txt` with the Write tool, then `git commit -F /tmp/commit-msg.txt`.
4. **Never edit `packages/shared/api.d.ts` manually** — it is AUTO-GENERATED. Run `just generate-types`.
5. **Subagents must `Read CLAUDE.md` as their very first step** — include this instruction explicitly in every subagent prompt.
6. **Never use raw hex colors or `text-primary` as a text color in the frontend** — use design token classes only. Never write `dark:` overrides.

```

- [ ] **Step 2: Verify line count stays reasonable**

Run:
```bash
wc -l CLAUDE.md
```
Expected: ≤ 135 lines (added ~15 lines). If over 140, trim equivalent length from the Production Infrastructure section by extracting it to `docs/INFRASTRUCTURE.md` and replacing with a one-line reference.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
```
Write to `/tmp/commit-msg.txt`:
```
docs: add CRITICAL RULES section to top of CLAUDE.md
```
Then: `git commit -F /tmp/commit-msg.txt`

---

### Task 2: Create SessionStart hook script

**Files:**
- Create: `.claude/hooks/session-start.sh`

The SessionStart hook injects critical rules as `additionalContext` into the model's context. This re-surfaces rules on every session start and after compaction.

- [ ] **Step 1: Create hooks directory and script**

```bash
mkdir -p .claude/hooks
```

Create `.claude/hooks/session-start.sh`:

```bash
#!/usr/bin/env bash
cat <<'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "CRITICAL RULES (from CLAUDE.md — re-read in full if uncertain):\n1. Always use 'just <cmd>' from repo root. Never cd into a subdirectory. Run 'just --list' before any direct invocation.\n2. Never start a Bash call with a # comment — it blocks auto-approval.\n3. git add and git commit must be separate Bash calls. Write message to /tmp/commit-msg.txt, then: git commit -F /tmp/commit-msg.txt\n4. Never edit packages/shared/api.d.ts manually — it is AUTO-GENERATED. Run: just generate-types\n5. Every subagent prompt must include: 'Your first step is to Read CLAUDE.md'\n6. Frontend: no raw hex colors, no text-primary as text color, no dark: overrides — use design tokens only."
  }
}
EOF
```

- [ ] **Step 2: Make script executable**

```bash
chmod +x .claude/hooks/session-start.sh
```

- [ ] **Step 3: Pipe-test the script**

```bash
echo '{}' | bash .claude/hooks/session-start.sh
```

Expected: valid JSON with `hookSpecificOutput.additionalContext` field printed to stdout. Exit code 0.

- [ ] **Step 4: Validate JSON output**

```bash
echo '{}' | bash .claude/hooks/session-start.sh | python3 -m json.tool
```

Expected: pretty-printed JSON with no errors.

---

### Task 3: Create PreToolUse Bash hook script

**Files:**
- Create: `.claude/hooks/pre-bash-check.sh`

This hook intercepts every Bash tool call and blocks any command that `cd`s into a subdirectory (`apps/`, `packages/`, `docker/`, `scripts/`), which is the most common violation.

- [ ] **Step 1: Create the hook script**

Create `.claude/hooks/pre-bash-check.sh`:

```bash
#!/usr/bin/env bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

if echo "$CMD" | grep -qE '(^|;|&&|\|\|)\s*cd\s+(apps|packages|docker|scripts|apps/|packages/|docker/|scripts/)'; then
  echo '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": "BLOCKED: Never cd into a subdirectory (CLAUDE.md rule 1). Target everything from the repo root instead. Use: just <cmd>, pnpm --filter <pkg> <cmd>, or uv run --project apps/api <cmd>."
    }
  }'
  exit 0
fi
```

- [ ] **Step 2: Make script executable**

```bash
chmod +x .claude/hooks/pre-bash-check.sh
```

- [ ] **Step 3: Pipe-test — should block**

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"cd apps/api && uv run pytest"}}' | bash .claude/hooks/pre-bash-check.sh
```

Expected: JSON with `permissionDecision: "deny"`. Exit code 0.

- [ ] **Step 4: Pipe-test — should allow**

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"just test-api"}}' | bash .claude/hooks/pre-bash-check.sh
```

Expected: empty output (no JSON). Exit code 0.

- [ ] **Step 5: Pipe-test — should allow cd to /tmp**

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"cd /tmp && ls"}}' | bash .claude/hooks/pre-bash-check.sh
```

Expected: empty output. Exit code 0.

---

### Task 4: Wire hooks in .claude/settings.json

**Files:**
- Create: `.claude/settings.json`

`.claude/settings.json` is project-scoped and committed — these hooks apply to all team sessions.

- [ ] **Step 1: Create settings.json with both hooks**

Create `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/session-start.sh",
            "timeout": 5,
            "statusMessage": "Loading project rules..."
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/pre-bash-check.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Validate JSON schema**

```bash
jq -e '.hooks.SessionStart[0].hooks[0].command' .claude/settings.json
```

Expected: prints `"bash .claude/hooks/session-start.sh"`, exit code 0.

```bash
jq -e '.hooks.PreToolUse[0].hooks[0].command' .claude/settings.json
```

Expected: prints `"bash .claude/hooks/pre-bash-check.sh"`, exit code 0.

- [ ] **Step 3: Confirm settings.local.json enabledMcpjsonServers is preserved**

The existing `settings.local.json` has `enabledMcpjsonServers` and `permissions`. These are in `settings.local.json` — a separate file — so they are unaffected by creating `settings.json`. Verify no overlap:

```bash
jq 'keys' .claude/settings.local.json
jq 'keys' .claude/settings.json
```

Expected: `settings.json` only has `"hooks"`. No key conflicts.

- [ ] **Step 4: Add hook scripts to git**

```bash
git add .claude/settings.json .claude/hooks/session-start.sh .claude/hooks/pre-bash-check.sh
```

Write to `/tmp/commit-msg.txt`:
```
chore(ci): add SessionStart and PreToolUse hooks for CLAUDE.md compliance

SessionStart injects critical rules into model context on every session
start, surviving compaction. PreToolUse blocks cd-into-subdirectory Bash
commands, the most common CLAUDE.md violation.
```
Then: `git commit -F /tmp/commit-msg.txt`

---

### Task 5: Prove hooks fire (SessionStart skipped — fires outside this turn)

The `update-config` skill calls out that SessionStart hooks fire outside the current turn and cannot be proven in-session. Skip the live-fire test for that one.

For the PreToolUse hook — verify it fires by triggering a harmless Bash call:

- [ ] **Step 1: Add a sentinel prefix temporarily**

Edit `.claude/settings.json` — change the PreToolUse command to:

```
bash -c 'echo \"$(date) hook fired\" >> /tmp/claude-hook-check.txt; bash .claude/hooks/pre-bash-check.sh'
```

- [ ] **Step 2: Trigger a harmless Bash call**

```bash
true
```

- [ ] **Step 3: Check sentinel file**

```bash
cat /tmp/claude-hook-check.txt
```

Expected: a line with today's date.

- [ ] **Step 4: Remove sentinel prefix**

Edit `.claude/settings.json` — restore command back to:

```
bash .claude/hooks/pre-bash-check.sh
```

- [ ] **Step 5: Clean up sentinel**

```bash
rm -f /tmp/claude-hook-check.txt
```

- [ ] **Step 6: Final commit if settings.json changed**

```bash
git add .claude/settings.json
```

Write `/tmp/commit-msg.txt`: `chore: restore hooks after sentinel test`

Then: `git commit -F /tmp/commit-msg.txt`

> **Note:** If the sentinel file is empty after triggering Bash, the settings watcher may not have loaded `.claude/settings.json` (it only watches directories that had a settings file when the session started). Open `/hooks` once to reload config, or restart the session. The hook is wired correctly if `jq` validation passed.
