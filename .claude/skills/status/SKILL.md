---
name: status
description: Answer "status" from the four memory files, read-only. Use when Patric says "status", "where are we" or "what waits on me".
---

# Status

Read-only. Four blocks, nothing else:

- **Questions**: every open entry of `docs/open-questions.md`, one line each, Decide or Default
  marked, with its component tag.
- **Done**: what is in staging and not yet live, in product words, from the changes between the
  two, one line each.
- **Notes**: every entry of `docs/known-bugs.md`, one line each.
- **Next**: "Where to pick up" from `docs/next-steps.md`, in two lines.
