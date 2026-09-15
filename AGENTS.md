# AGENTS.md - Kowboy Core

Every agent reads this file before doing any work. `CLAUDE.md` only imports it. This file is protected, and changes need approval.

## What this is

Kowboy Core ("Core") is one central service. It reads real estate CRMs, normalizes their data into one model and lets any number of thin clients (a WordPress plugin, Lovable sites) pull changes by cursor.

| Document | Role |
|---|---|
| [docs/strategy.md](docs/strategy.md) | **The authoritative plan**, including the current phase (§9). Where it conflicts with the inputs, it wins. |
| [docs/inputs/Kowboy_Kore_Concept.md](docs/inputs/Kowboy_Kore_Concept.md) | The *why*. Its rules settle arguments. |
| [docs/inputs/Kowboy_Kore_SRS_v1.2.md](docs/inputs/Kowboy_Kore_SRS_v1.2.md) | The original spec, amended by strategy §12. |
| [docs/decisions.md](docs/decisions.md) | One line per structural decision. Append only. |

## Absolute rules

Rules marked **[CI]** must have a CI check that fails when broken. Until the check exists, follow the rule by hand.

### Principles

1. **Simple beats clever.** When two designs work, the one with less code wins. Nothing is built for a need that doesn't exist yet.
2. **The seam [CI].** The engine knows nothing about any CRM and never names one. Adapters know nothing about engine storage. The engine never imports an adapter. Clients never name a CRM.
3. **All data logic lives in Core.** Clients are templates plus a sync loop.
4. **Tests are the acceptance.** Every change is verified automatically. If something can't be tested automatically, raise it as a design problem. Never add a manual step.
5. **No legacy access.** Never read, request or search old plugin repos, other repositories, legacy code or other conversations. Anything needed from the past arrives as human-written specs, ledger entries or golden masters.

### Code

6. **Plain code [CI].**
   - Write plain functions, plain data, and SQL where it is used.
   - Banned: classes (so no inheritance), decorators, dependency-injection containers, generic repository/factory/strategy/event-bus layers, wrappers around libraries, and advanced type-level programming.
   - A library that truly requires a class goes on an approved allowlist.
7. **One code path per concern [CI].** The same logic never exists twice. Before writing, search for the existing function and use it. No options or flags for cases that don't exist yet.
8. **Readable functions [CI].** Stay under the cognitive complexity limit. A function that needs a comment to explain its flow should be simpler.
9. **Shallow indirection [CI].** An endpoint or job must be understandable by reading at most about 3 files.
10. **No dead code [CI].** No unused files, exports, functions, methods or dependencies. Delete, don't comment out.
11. **No escape hatches [CI].** No `any`, no lint suppressions, no skipped tests.
12. **No new runtime dependency or vendor [CI]** without approval.
13. **Generated files are never edited by hand [CI].**
14. **LF line endings, UTF-8** everywhere.

### Contract and data

15. **Additive contract only [CI].** Never rename, remove or retype a served field in one step. Use expand → migrate → contract (strategy §6).
16. **Never make a test pass by editing its expected output.**
17. **Protected paths [CI].** `schemas/`, `rules-ledger/`, `acceptance/`, infra files and this file need approval (CODEOWNERS). The same applies to `golden/` until go-live. `golden/fake/` is dummy data that agents own.
18. **Never invent business rules.** They come from `rules-ledger/`. A missing rule is a question.

### Naming and layout

19. **Naming [CI].** The product is "Kowboy Core" or "Core"; its CRM-agnostic part is the **engine**. Never write "Kore" outside `docs/inputs/`.
20. **Fixed layout [CI].** Adding a top-level folder needs a line in `docs/decisions.md`.

```
engine/               CRM-agnostic: storage, jobs, rules runner, bells, API, health, event log
adapters/<provider>/  everything CRM-specific, one folder per CRM
clients/wordpress/    thin WordPress client
clients/lovable-kit/  Supabase sync + bell functions for Lovable sites
schemas/              JSON Schema per datatype (current shape, source of truth)
golden/<provider>/    payload.json → canonical.json + display.json per case (initial build)
rules-ledger/         human-written business rules, one entry per rule
acceptance/           acceptance criteria → named tests → generated report
docs/                 strategy, decisions, inputs
```

## Stop and ask

Stop and ask the person who gave you the task, and don't improvise, when a task needs any of these:

- a change to a contract, schema, rules ledger, golden master or acceptance criterion
- a new runtime dependency, vendor or recurring cost
- a decision the Concept doesn't settle. First ask which side of the seam it belongs on, then pick the smaller option. If both still look reasonable, ask.
- action on a production incident

## Definition of done

1. All CI checks are green.
2. The acceptance report is updated if an acceptance criterion's status changed.
3. A `docs/decisions.md` line exists for any structural choice.
4. Strategy §9 is updated if the phase moved.
