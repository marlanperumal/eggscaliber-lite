#!/usr/bin/env bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$CMD" ]; then
  echo "pre-bash-check: JSON parse failed or empty command — allowing" >&2
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
fi

if echo "$CMD" | grep -qE '(^|;|&&|\|\|)\s*cd\s+(apps|packages|docker|scripts)(\/|$|\s)'; then
  echo '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": "BLOCKED: Never cd into a subdirectory (CLAUDE.md rule 1). Target everything from the repo root instead. Use: just <cmd>, pnpm --filter <pkg> <cmd>, or uv run --project apps/api <cmd>."
    }
  }'
else
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
fi
