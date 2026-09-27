---
name: start
description: Start a repository for agent-driven work, or bring an existing one up to the Kowboy setup. Use when a repository is new, lacks docs/strategy.md, acceptance criteria or the four memory files, or when Patric says "set up this repo".
---

# Start a project

**Intention.** From the first session on, every later session finds the same things in the same
places, and the first thing Patric decides is the plan, not a detail.

1. **The kit.** Copy the template into the repository root: `AGENTS-shared.md`, `CLAUDE.md`,
   `PLAYBOOK.md`, `.claude/` (hooks, skills, settings), the four memory files under `docs/`,
   `scripts/check-register.mjs` and `.github/CODEOWNERS`. Write `AGENTS.md` from the skeleton with
   only what is true in this project: its components and tags, its commands, its hard blocks.
2. **The inputs.** Put what Patric has (a concept, a spec, reference sites, existing data, old
   documents) under `docs/inputs/`, unchanged. What is missing and needed becomes Decides in the
   register, at most five in the first reply.
3. **The strategy**, `docs/strategy.md`, in this order: the purpose in three sentences; the
   components and the named interfaces between them; the data at rest (its shapes, which component
   owns each); the technology, each choice the market-leading option with one clause why; hosting
   and how a change reaches staging and live; the phases, each with a gate that says what must be
   true to pass it; the acceptance criteria, numbered `AC n`, each one testable without a person;
   what is out of scope. The strategy names which document wins when the inputs disagree.
4. **Gate 1 is Patric approving the strategy.** Present it as at most five Decides with one clause
   of consequence each; the approval is a line in `docs/decisions.md`.
5. **The skeleton.** The repository layout from the strategy, one folder per component; CI with the
   enforced checks (build, typecheck, tests with no skips, no secrets, plus the project's own);
   staging deployed from the converged branch; `acceptance/criteria.json` mapping every `AC n` to a
   named test and a script that writes `acceptance/report.md` from a real test run. The order of
   work goes into `docs/next-steps.md` with "Where to pick up" on top.

**Done when** a new session told only "resume next steps" starts on the right item; a red check
blocks; and the acceptance report lists every criterion with its test or "no test yet".
