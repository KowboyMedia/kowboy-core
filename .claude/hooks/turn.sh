#!/bin/bash
# Reprints the reply protocol and the register's next number before every answer. Rules read once
# at the start of a session are followed less as the session grows long; one short line per turn
# keeps them in view. Claude Code adds a UserPromptSubmit hook's output to the context.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
next=""
if [ -f docs/open-questions.md ]; then
  next=$(grep -oE 'Next number: [0-9]+' docs/open-questions.md | head -1 | grep -oE '[0-9]+')
fi
echo "Reply protocol: Questions (register numbers${next:+, next is $next}; one decision per question ending in ?, options one per line with the answer word in bold, last line 'Reply: ...') / Done (one line per change, verified, undo) / Notes (only if a decision needs it) / Next (one imperative line)."
exit 0
