#!/bin/bash
# Keeps a session from ending with work saved only on this machine. Runs as a Stop hook: when the
# agent is about to finish its turn with saved changes that have not reached GitHub, the hook
# refuses (exit 2) and the agent gets the message, so the work is sent before the turn ends.
# Work in progress that is not yet saved is allowed: a session may pause to ask a question.
set -uo pipefail
# When the repository carries its own copy of this hook, that copy runs and this one steps aside.
[ -x "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/stop.sh" ] && [ "${BASH_SOURCE[0]}" != "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/stop.sh" ] && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
input=$(cat)
# A second pass after this hook already spoke: let the turn end, never loop.
case "$input" in *'"stop_hook_active":true'*) exit 0 ;; esac
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
[ "$branch" = "HEAD" ] && exit 0
if ! git rev-parse --verify -q "origin/$branch" >/dev/null 2>&1; then
  echo "The saved work on '$branch' has never been sent to GitHub. Send it (git push -u origin $branch), then finish." >&2
  exit 2
fi
ahead=$(git rev-list --count "origin/$branch..HEAD" 2>/dev/null || echo 0)
if [ "$ahead" -gt 0 ]; then
  echo "$ahead saved change(s) on '$branch' have not reached GitHub. Send them (git push), then finish." >&2
  exit 2
fi
exit 0
