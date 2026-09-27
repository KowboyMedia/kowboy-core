#!/bin/bash
# Prints the project's memory into the session at start, so a session begins where the last one
# ended without reading the files first: where to pick up, the open questions with the register's
# next number, the known bugs, and how far this copy is behind staging. Claude Code adds a
# SessionStart hook's output to the context. Read-only; never fails the session.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

echo "## Project memory at session start (printed by .claude/hooks/context.sh)"
echo
if [ -f docs/next-steps.md ]; then
  # The "Where to pick up" section: from its heading to the next "## " heading.
  awk '/^## Where to pick up/{p=1} /^## /{if(p&&!/^## Where to pick up/)exit} p' docs/next-steps.md
  echo
fi
if [ -f docs/open-questions.md ]; then
  echo "Open questions (docs/open-questions.md), $(grep -oE 'Next number: [0-9]+' docs/open-questions.md | head -1 | tr 'N' 'n'):"
  grep -E '^## [0-9]+\.' docs/open-questions.md | sed 's/^## /- /' || echo "- none"
  echo
fi
if [ -f docs/known-bugs.md ]; then
  echo "Known bugs (docs/known-bugs.md):"
  grep -E '^## [0-9]+\.' docs/known-bugs.md | sed 's/^## /- /' || echo "- none"
  echo
fi
# How this copy relates to the converged state. Skipped quietly when the network is not there.
if git fetch -q origin staging 2>/dev/null; then
  behind=$(git rev-list --count HEAD..origin/staging 2>/dev/null || echo "?")
  ahead=$(git rev-list --count origin/staging..HEAD 2>/dev/null || echo "?")
  echo "This copy vs staging: $behind change(s) in staging not here, $ahead change(s) here not in staging."
fi
exit 0
