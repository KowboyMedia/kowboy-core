# AGENTS.md - Kowboy Core

Every agent reads this file before doing any work. The company handbook (how agents work at
Kowboy) is not a file here: it reaches every session from the claude.ai account as a plugin
(decision of 2026-10-01, question 117); where the two differ, this file wins. `CLAUDE.md` only
imports this file. This file is protected, and changes need approval.

## What this is

Kowboy Core ("Core") is one central service. It reads real estate CRMs, normalizes their data into one model and lets any number of thin clients (a WordPress plugin, Lovable sites) pull changes by cursor.

| Document                                                                   | Role                                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [docs/strategy.md](docs/strategy.md)                                       | **The authoritative plan**, including the current phase (§9). Where it conflicts with the inputs, it wins. |
| [docs/inputs/Kowboy_Kore_Concept.md](docs/inputs/Kowboy_Kore_Concept.md)   | The _why_. Its rules settle arguments.                                                                     |
| [docs/inputs/Kowboy_Kore_SRS_v1.2.md](docs/inputs/Kowboy_Kore_SRS_v1.2.md) | The original spec, amended by strategy §12.                                                                |
| [docs/decisions.md](docs/decisions.md)                                     | One line per structural decision. Append only.                                                             |
| [docs/open-questions.md](docs/open-questions.md)                           | The register of questions to Patric; its header says the next number.                                      |
| [docs/next-steps.md](docs/next-steps.md)                                   | The order of work. "Resume next steps" means: do the first item that is not done.                          |
| [docs/known-bugs.md](docs/known-bugs.md)                                   | What is wrong and known, with what fixing it takes.                                                        |

Components and their tags: `[core]` the engine, `[crm]` any adapter, `[crm-vitec]`, `[crm-mspecs]`, `[client-wordpress]`, `[client-lovable]`, `[admin]` the admin area, `[handbook]` the agent setup itself (this file, the hooks, the registers; `[agents]` in older entries).

Design: `DESIGN.md` for the admin area and the WordPress templates once one is derived (the design skill); until then, the reference is norbanmakleri.se for the templates and the framework's defaults for the admin area.

## Enforced: CI blocks merge or deploy

These are the only hard blocks. Don't add more without approval.

1. **Build, typecheck and all tests pass.** A skipped test counts as a failure.
2. **The seam.** The engine never imports or calls adapter code, and no CRM name appears in `engine/` or `clients/`. Adapters import only `engine/adapter-api/` and nothing else from the engine. Only the entrypoint `main.ts` imports both.
3. **Protected paths need approval** (CODEOWNERS): `engine/adapter-api/`, `schemas/`, `acceptance/`, `rules-ledger/`, `golden/` (until go-live) and this file. `golden/fake/` is dummy data that agents own.
4. **No committed secrets.**
5. **Release:** the impact preview finds no item failing the schema or invariants.
6. **Production:** human approval, and a passing health check.

## Warnings: reported, never block

Lint findings (including function complexity), duplicate code, dead code (unused files, exports, functions, methods, dependencies), `any` and lint suppressions, new runtime dependencies, breaking schema changes, and the register check (duplicate question or bug numbers, a header counter that is not ahead of every number).

## Principles

- **The seam.** The engine knows nothing about any CRM. Clients never name a CRM.
  - **Adapters own everything CRM-specific:** authentication, HTTP, rate limits, and deciding when and how to fetch (webhooks, polling, catch-up). That includes their own HTTP endpoints such as webhook listeners, running their own schedules and timers, and any queue, dedupe or retries in their own tables.
  - **The engine has no queues, webhooks or schedules.** Adapters know nothing about engine storage.
- **The adapter bends to the engine, never the other way round.**
  - Never call CRM-specific code from the engine.
  - No CRM-specific branches, flags, config keys, workarounds or hacks in the engine.
  - If an adapter needs something `engine/adapter-api/` doesn't offer, propose a _generic_ engine capability any adapter could use. That needs approval.
- **All data logic lives in Core.** Clients are templates plus a sync loop.
- **The CRM's list defines what exists.** Core syncs what a CRM lists for the sites (Vitec: the marketed estates) and nothing else. In the list: on the sites. A Remove notification, or gone from the list: deleted, without a fetch.
- **Core applies no logic to CRM data.** Three faces per record: `raw` (the payload untouched), `universal` (`data`: the CRM's fields copied and renamed onto the universal names, plus the ids that link records) and `display` (prepared strings). The CRM-to-universal mapping lives in the CRM's adapter. The engine computes `display` from `universal` by human-written ledger entries, one interpreter for every CRM, and never reads a CRM field. Nowhere in Core is there a decision drawn from a value: no tag, no status, no visibility, no publish, no flag. Tags and slugs are the site's, from what it stores. This holds in code and in discussion alike: never propose "Core delivers a flag" or "the slug comes from Core", and never assume the SRS where it says otherwise (strategy §12 amends it). WordPress sets its own slugs under Swedish paths: property `objekt/<status>-<area name>-<street address>-<id>`, project `projekt/` the same, agent `maklare/<first name>-<last name>-<id>`, area `omrade/<municipality>-<area name>-<id>`, office `kontor/<office name>-<id>`, association `forening/<association name>-<id>`; every entity ends in `-<id>` (Patric, 2026-09-17 to 2026-09-19, made permanent after six repeats).
- **Anything derived must be patchable** from stored raw data without CRM traffic.
- **No legacy access, and nothing from the old plugins.** Never read, request or search old plugin repos, other repositories, legacy code or other conversations. **Under no circumstances take code or concepts from the WordPress plugins v1, v2 or v3** unless Patric explicitly asks for it or approves it, item by item; this is a hard rule, not a guideline (Patric, 2026-09-19). Anything needed from the past arrives as human-written specs, ledger entries or golden masters.

## Contract and data

- **One contract shape.** Additive changes are fine. A breaking change (rename, remove, retype) is done as expand → migrate → contract in separate releases (strategy §6).
- **Business rules come from `rules-ledger/`** and contract fields from `schemas/` and `docs/field-tables.md`. A missing rule or field is a question, never an invention.
- **Ask before adding a runtime dependency or vendor.**

## Naming and layout

- **Naming.** The product is "Kowboy Core" or "Core"; its CRM-agnostic part is the **engine**. Never write "Kore" outside `docs/inputs/`.
- **Layout.** Adding a top-level folder needs a line in `docs/decisions.md`.

```
main.ts               entrypoint: starts engine, mounts adapter endpoints, starts adapters; the only file importing both
engine/               CRM-agnostic: storage, rules runner, bells, subscriber API, recompute, health, event log
engine/adapter-api/   the only engine code adapters may import (protected)
engine/admin/         the admin area's JSON API, under /v1/admin/ (docs/admin-panel.md)
admin/                the admin area's browser app, built into dist/admin and served under /admin
adapters/<provider>/  everything CRM-specific, incl. webhooks, schedules, fetch lists, one folder per CRM
clients/wordpress/    thin WordPress client
clients/lovable-kit/  Supabase sync + bell functions for Lovable sites
schemas/              JSON Schema per datatype (current shape, source of truth)
golden/<provider>/    payload.json → canonical.json + display.json per case (initial build)
rules-ledger/         human-written business rules, one entry per rule
acceptance/           acceptance criteria → named tests → generated report
docs/                 strategy, decisions, inputs
```

## Stop and ask

In addition to the handbook's list, stop and ask when a task needs any of these:

- a change to the adapter API, a contract, schema, rules ledger, golden master or acceptance criterion
- a decision the Concept doesn't settle. First ask which side of the seam it belongs on, then pick the smaller option. If both still look reasonable, ask.
- **a write to a CRM** (a lead, an interest, a booking, a contact, a search profile, even one "test" send) **whose target Patric has not confirmed as a demo or test system: never send it.** The staging site's connections are a client's production connections, and the Vitec login in the environment reads a client's production office; a read is fine there, a write never is (Patric, 2026-10-04).
- **anything new that a person sees in the admin area** (a page, a section, a field, a setting, a line) **or that runs in Core** (a web address, a table or column, an event, a health check, an environment setting, an outside service): it is named as its own line in a register question before it is built, even inside a design. An approval covers only the lines its question listed, a round may still be answered "ok" for all of them, and anything the build finds it needs beyond them is a new question, not a choice (Patric, 2026-10-05: "you should have asked me about those"). Text a user reads (the admin area, the form window, Core's answers to sites) never cites a register number, a person, a date or an internal document (Patric, 2026-10-05: "that certainly does not belong in production").

## Definition of done

In addition to the handbook's definition:

1. The acceptance report is updated if an acceptance criterion's status changed.
2. Strategy §9 is updated if the phase moved.
3. **The admin panel tells the truth** (Patric, 2026-09-20: keep it fresh). A change to a page, an
   action, a setting, a lifecycle event or a health check carries its words in the same change: the
   panel's own text, the adapter's setup directions and `docs/admin-panel.md`. The tests that read
   them stay green: `adapters/*/admin/directions.test.ts` (every setting, event, health check and
   credential field is named) and the acceptance test that every page a direction names exists.
4. **Every button in the admin area explains itself beside it** (Patric, 2026-10-06: "next to its
   button explain to a cold reader what it does, as always in admin UI"): a sentence or two that a
   reader new to Core understands, saying what pressing it does and when to press it, shown next
   to the button, never only on hover.
5. **Every text is written for a cold reader** (Patric, 2026-10-06, of the Overview's health checks
   and "Needs attention": "these issues tell me nothing"), by the handbook's rule "Every text in
   the product is written for the person who reads it". In Core that means:
   - A health check shows a title and a sentence, never its name (`vitec.catch_up`,
     `subscribers`), and an event shows its sentence, never its type (`office.taken_off`).
   - A tenant is named by its name; a connection by its tenant and CRM, then its name
     ("Acme's Vitec connection “Main”"), never by Core's own id for it (Patric, 2026-10-07); a
     site by its name and its tenant; an office by its name, then the CRM's id for it; a record
     by its address or name.
   - Each named thing links to its place: a tenant, connection or site to the tenant's page
     (`/tenants/<id>`, `#connection:<Core's id for it>`, `#site:<id>`), an office or a record to
     Records, a form to Failed forms, a CRM to its page.
   - A problem says what it means for the sites (homes missing or out of date, a form not
     delivered), what to do, and on which page.
   - The mails and Slack messages Core sends, and Core's answers to sites, are held to the same
     rule as the admin area.
