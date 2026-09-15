# AGENTS.md - Kowboy Core

Every agent reads this file before doing any work. `CLAUDE.md` only imports it. This file is protected, and changes need Patric's approval.

## What this is

Kowboy Core ("Core") is one central service. It reads real estate CRMs, normalizes their data into one model and lets any number of thin clients (a WordPress plugin, Lovable sites) pull changes by cursor.

| Document | Role |
|---|---|
| [docs/strategy.md](docs/strategy.md) | **The authoritative plan.** Where it conflicts with the inputs, it wins. |
| [docs/inputs/Kowboy_Kore_Concept.md](docs/inputs/Kowboy_Kore_Concept.md) | The *why*. Its rules settle arguments. |
| [docs/inputs/Kowboy_Kore_SRS_v1.2.md](docs/inputs/Kowboy_Kore_SRS_v1.2.md) | The original spec, amended by strategy §12. Its decisions are suggestions. |
| [docs/decisions.md](docs/decisions.md) | One line per structural decision. Append, never rewrite. |

## Current state

- **Gate 1 (strategy and acceptance criteria): approved 2026-09-15.**
- **Current phase: 1 - Foundation, not started.** See strategy §9. Deliverables:
  1. Hosting pick against the strategy §2 criteria, sent to Patric as an FYI with a monthly cost estimate.
  2. Monorepo layout, toolchain and every CI guard from strategy §3.
  3. Staging and production environments as infrastructure as code; staging auto-deploys from `main`, and production deploys through GitHub Environment approval by Patric.
  4. Sentry (EU) wired in, and `/v1/health` returning 200 or 500 with named checks.
  5. A "hello health" app flowing PR → staging → approved → production.
- **Update this section whenever a phase or gate changes.**

## Working with Patric (owner)

- **He never reads code.** Communicate in plain language. Decisions go to him as short numbered questions with a recommendation.
- **Approval gates** (strategy §9): Gate 2 is canonical-model field tables, Gate 3 is real golden masters and the rules ledger, Gate 4 is go-live. After go-live, each production release needs one click from him.
- **Stop and ask**, and don't improvise, when a task needs any of these:
  - a change to a contract, schema, golden master, rules ledger or acceptance criterion
  - a new runtime dependency, vendor or recurring cost
  - a gap the Concept can't settle ("which side of the seam, then the smaller option"; if both still look reasonable, ask)
  - a production incident
- **Non-blocking defaults** you may pick yourself, then report as an FYI and log in `docs/decisions.md`.

## Absolute rules

These apply from the first commit. Phase 1 turns each checkable rule into a CI check, and each rule is then tagged **[CI]** here.

1. **No legacy access.** Never read, request or search the old WordPress plugin repos, other repos, or other conversations. Humans extract anything needed as specs, ledger entries or golden masters. Never paste legacy code.
2. **Naming.** The product is "Kowboy Core" or "Core". Its CRM-agnostic part is the **engine**. Never write "Kore" outside `docs/inputs/`.
3. **The seam.** The engine knows nothing about any CRM and never names one. Adapters know nothing about engine storage. The engine never imports an adapter. Clients never name a CRM.
4. **Simple beats clever.** When two designs work, the one with less code wins. No abstraction "for later". Nothing is added without a present need.
5. **Tests are the acceptance.** Every change is verified by automated tests. If something can't be tested automatically, that is a design problem to raise, not a manual step to add.
6. **Never make a test pass by editing its expected output.** `schemas/`, `golden/<real provider>/`, `rules-ledger/`, `acceptance/`, infra files and this file need Patric's approval. `golden/fake/` is agent-owned dummy data.
7. **Never invent business rules.** Rules come from the rules ledger. A missing rule becomes a question to Patric.
8. **No new runtime dependency or vendor** without approval.
9. **One way to do each thing.** Before writing a pattern (logging, errors, jobs, SQL, HTTP handlers), find the existing reference implementation and copy it. If none exists, the first one becomes the reference, and gets a line in `docs/decisions.md`.
10. **Small units.** Keep files and functions short. No `any`, no lint suppressions, no skipped tests. Phase 1 sets the exact limits in CI.
11. **Generated files are never edited by hand.**
12. **LF line endings, UTF-8** everywhere. Golden masters are compared byte for byte.

## Target layout

Phase 1 creates only what it needs. Adding any other top-level folder needs a decision entry.

```
engine/               CRM-agnostic core: storage, jobs, rules runner, bells, API, health, trace
adapters/<provider>/  everything CRM-specific, one folder per CRM
clients/wordpress/    thin WordPress client
clients/lovable-kit/  Supabase sync + bell functions for Lovable sites
schemas/              JSON Schema per datatype per version (source of truth)
golden/<provider>/    payload.json → canonical.json + display.json per case
rules-ledger/         human-written business rules, one entry per rule
acceptance/           acceptance criteria → named tests → generated report
docs/                 strategy, decisions, inputs
```

## Definition of done

1. All CI checks green.
2. The acceptance report is updated if an acceptance criterion's status changed.
3. A `docs/decisions.md` line exists for any structural choice.
4. The "Current state" section above is updated if the phase moved.
