#!/bin/bash
# Formats a file right after the agent writes it, so formatting is never left to a reminder.
# Runs as a PostToolUse hook on Edit and Write; the tool's input arrives as JSON on stdin. Uses the
# project's formatter when one is configured (Prettier today); silent and harmless otherwise.
set -uo pipefail
# When the repository carries its own copy of this hook, that copy runs and this one steps aside.
[ -x "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/format.sh" ] && [ "${BASH_SOURCE[0]}" != "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/format.sh" ] && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
input=$(cat)
file=$(printf '%s' "$input" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.file_path??"")}catch{}})' 2>/dev/null)
[ -n "$file" ] && [ -f "$file" ] || exit 0
if [ -f .prettierrc ] || [ -f .prettierrc.json ] || grep -q '"prettier"' package.json 2>/dev/null; then
  case "$file" in
    *.ts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.md|*.yml|*.yaml|*.css|*.html)
      npx --no-install prettier --write "$file" >/dev/null 2>&1 || true ;;
  esac
fi
exit 0
