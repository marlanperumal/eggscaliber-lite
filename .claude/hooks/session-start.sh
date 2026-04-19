#!/usr/bin/env bash
cat <<'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "CRITICAL RULES (from CLAUDE.md — re-read in full if uncertain):\n1. Always use 'just <cmd>' from repo root. Never cd into a subdirectory. Run 'just --list' before any direct invocation.\n2. Never start a Bash call with a # comment — it blocks auto-approval.\n3. git add and git commit must be separate Bash calls. Write message to /tmp/commit-msg.txt, then: git commit -F /tmp/commit-msg.txt\n4. Never edit packages/shared/api.d.ts manually — it is AUTO-GENERATED. Run: just generate-types\n5. Every subagent prompt must include: 'Your first step is to Read CLAUDE.md'\n6. Frontend: no raw hex colors, no text-primary as text color, no dark: overrides — use design tokens only."
  }
}
EOF
