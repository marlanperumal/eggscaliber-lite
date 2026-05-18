#!/usr/bin/env bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$CMD" ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
fi

if ! echo "$CMD" | grep -qE '(^|;|&&|\|\|)\s*git\s+push(\s|$)'; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
fi

if echo "$CMD" | grep -q 'SKIP_PRE_PUSH=1'; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
fi

cd "$(git rev-parse --show-toplevel)" || {
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
}

OUT=$(just lint 2>&1 && just format-check 2>&1 && just typecheck 2>&1 && just test 2>&1)
RC=$?

if [ $RC -eq 0 ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
fi

TAIL=$(echo "$OUT" | tail -80 | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "BLOCKED: pre-push checks failed (lint / format-check / typecheck / test). Fix the failures below and retry. To bypass for a deliberate WIP push, prefix with SKIP_PRE_PUSH=1.\n\n--- output tail ---\n${TAIL:1:-1}"
  }
}
EOF
