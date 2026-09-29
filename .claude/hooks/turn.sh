#!/bin/bash
# Reprints the reply protocol and the register's next number before every answer. Rules read once
# at the start of a session are followed less as the session grows long; one short line per turn
# keeps them in view. Claude Code adds a UserPromptSubmit hook's output to the context.
set -uo pipefail
# When the repository carries its own copy of this hook, that copy runs and this one steps aside.
[ -x "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/turn.sh" ] && [ "${BASH_SOURCE[0]}" != "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/turn.sh" ] && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
next=""
if [ -f docs/open-questions.md ]; then
  next=$(grep -oE 'Next number: [0-9]+' docs/open-questions.md | head -1 | grep -oE '[0-9]+')
fi
echo "Reply protocol, bullets not paragraphs, tag in backticks: Questions (each labelled with its register number in bold${next:+, next is $next}, never a list position; one decision per question ending in ?; options a) b) c) one per line with the answer word in bold; last line 'Reply: a, b or c') / Done (one bullet per change; sub-bullets: verified, undo) / Notes (only if a decision needs it) / Next (one imperative bullet)."
exit 0
