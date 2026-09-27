---
name: release
description: Release staging to live, watch health, and handle production incidents. Use when Patric says "release", when a health check goes red, or when something is wrong in production.
---

# Release and operate

**Release.** Live changes only on Patric's word, and every release can be taken back in one step.

1. Every check is green on staging and the acceptance report is current.
2. The impact preview: what data and behaviour change for users, in product words.
3. The release note is the Done block: one line per change, how each was verified.
4. Patric says "release". Nothing goes live before.
5. Promote staging to live; watch the health check until green; keep the previous version ready
   and say in one line how it comes back ("say 'undo the release'").
6. A `docs/decisions.md` line "Release <date>", and "Where to pick up" in `docs/next-steps.md`
   updated.

**First go-live** adds to a release: the domain and certificates answer; backups run and a restore
was rehearsed on staging; health checks and alerts are in place and were seen firing once; the
undo is known; who is told, and in which words, is written before the switch; personal data and
credentials were checked to be only where the design says.

**Operate.** Health checks explain themselves in plain words and counts; an alert goes where a
person sees it; events carry ids that connect them; logs hold ids, never personal data.

**Maintain.** Dependencies are updated in one item a month with every test green, market-leading
versions only; dead code and rules nobody would break without them are removed as they are found.

**Incident.** Any action on production is a Decide. First make it safe (take back the last release
if it is the cause), then find the cause, then fix it forward through staging. The cause gets a
`docs/known-bugs.md` entry until fixed, and a rule or decision if it can happen again: twice is a
rule. A symptom is never fixed silently.
