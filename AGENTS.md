# AGENTS.md - Kowboy Core

Every agent reads this file before doing any work. `CLAUDE.md` only imports it. This file is protected, and changes need approval.

## What this is

Kowboy Core ("Core") is one central service. It reads real estate CRMs, normalizes their data into one model and lets any number of thin clients (a WordPress plugin, Lovable sites) pull changes by cursor.

| Document                                                                   | Role                                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [docs/strategy.md](docs/strategy.md)                                       | **The authoritative plan**, including the current phase (§9). Where it conflicts with the inputs, it wins. |
| [docs/inputs/Kowboy_Kore_Concept.md](docs/inputs/Kowboy_Kore_Concept.md)   | The _why_. Its rules settle arguments.                                                                     |
| [docs/inputs/Kowboy_Kore_SRS_v1.2.md](docs/inputs/Kowboy_Kore_SRS_v1.2.md) | The original spec, amended by strategy §12.                                                                |
| [docs/decisions.md](docs/decisions.md)                                     | One line per structural decision. Append only.                                                             |
| [docs/next-steps.md](docs/next-steps.md)                                   | The order of work. "Resume next steps" means: do the first item that is not done.                          |

## Enforced: CI blocks merge or deploy

These are the only hard blocks. Don't add more without approval.

1. **Build, typecheck and all tests pass.** A skipped test counts as a failure.
2. **The seam.** The engine never imports or calls adapter code, and no CRM name appears in `engine/` or `clients/`. Adapters import only `engine/adapter-api/` and nothing else from the engine. Only the entrypoint `main.ts` imports both.
3. **Protected paths need approval** (CODEOWNERS): `engine/adapter-api/`, `schemas/`, `acceptance/`, `rules-ledger/`, `golden/` (until go-live) and this file. `golden/fake/` is dummy data that agents own.
4. **No committed secrets.**
5. **Release:** the impact preview finds no item failing the schema or invariants.
6. **Production:** human approval, and a passing health check.

## Warnings: reported, never block

Lint findings (including function complexity), duplicate code, dead code (unused files, exports, functions, methods, dependencies), `any` and lint suppressions, new runtime dependencies, and breaking schema changes.

**Leave every file you touch free of warnings.**

## Guidelines

### Principles

- **Simple beats clever.** When two designs work, the one with less code wins. Nothing is built for a need that doesn't exist yet.
- **The seam.** The engine knows nothing about any CRM. Clients never name a CRM.
  - **Adapters own everything CRM-specific:** authentication, HTTP, rate limits, and deciding when and how to fetch (webhooks, polling, catch-up). That includes their own HTTP endpoints such as webhook listeners, running their own schedules and timers, and any queue, dedupe or retries in their own tables.
  - **The engine has no queues, webhooks or schedules.** Adapters know nothing about engine storage.
- **The adapter bends to the engine, never the other way round.**
  - Never call CRM-specific code from the engine.
  - No CRM-specific branches, flags, config keys, workarounds or hacks in the engine.
  - If an adapter needs something `engine/adapter-api/` doesn't offer, propose a _generic_ engine capability any adapter could use. That needs approval.
- **All data logic lives in Core.** Clients are templates plus a sync loop.
- **The CRM's list defines what exists.** Core syncs what a CRM lists for the sites (Vitec: the marketed estates) and nothing else. In the list: on the sites. A Remove notification, or gone from the list: deleted, without a fetch. Core and its adapters decide nothing from a field's value: no publish, status or visibility logic anywhere in Core (Patric, 2026-09-17).
- **Tests are the acceptance.** If something can't be tested automatically, raise it as a design problem. Never add a manual step.
- **Anything derived must be patchable** from stored raw data without CRM traffic.
- **No legacy access, and nothing from the old plugins.** Never read, request or search old plugin repos, other repositories, legacy code or other conversations. **Under no circumstances take code or concepts from the WordPress plugins v1, v2 or v3** unless Patric explicitly asks for it or approves it, item by item; this is a hard rule, not a guideline (Patric, 2026-09-19). Anything needed from the past arrives as human-written specs, ledger entries or golden masters.

### Code

- **One code path per concern.** The same logic never exists twice. Search for the existing function before writing a new one. No options or flags for cases that don't exist yet.
- **Readable code.** A reader should understand an endpoint or job from a few files. Avoid framework-style layers: dependency-injection containers, generic repositories, wrappers around libraries.
- **Delete rather than comment out.**
- **Ask before adding a runtime dependency or vendor.**

### Contract and data

- **One contract shape.** Additive changes are fine. A breaking change (rename, remove, retype) is done as expand → migrate → contract in separate releases (strategy §6).
- **Never make a test pass by editing its expected output.**
- **Never invent business rules.** They come from `rules-ledger/`. A missing rule is a question.
- **Never invent a contract field.** A field nobody wrote down is a question.

### Naming and layout

- **Naming.** The product is "Kowboy Core" or "Core"; its CRM-agnostic part is the **engine**. Never write "Kore" outside `docs/inputs/`.
- **Layout.** Adding a top-level folder needs a line in `docs/decisions.md`.

```
main.ts               entrypoint: starts engine, mounts adapter endpoints, starts adapters; the only file importing both
engine/               CRM-agnostic: storage, rules runner, bells, subscriber API, recompute, health, event log
engine/adapter-api/   the only engine code adapters may import (protected)
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

Stop and ask the person who gave you the task, and don't improvise, when a task needs any of these:

- a change to the adapter API, a contract, schema, rules ledger, golden master or acceptance criterion
- a new runtime dependency, vendor or recurring cost
- a decision the Concept doesn't settle. First ask which side of the seam it belongs on, then pick the smaller option. If both still look reasonable, ask.
- action on a production incident

**A closed gate is not a note.** When something on this list is needed and nobody is there to answer, build only what does not depend on it, leave the gap visibly empty, and put the question in `docs/open-questions.md`. Never fill a gap provisionally: a placeholder that looks real gets built on and believed.

## Working with Patric

Patric's only interface is this chat. He decides product questions; agents do all the work, git,
infrastructure and configuration included. These rules exist because sessions kept handing him
instructions instead of results.

- **Do it yourself first.** Never ask Patric to edit a file, run a command, open a console or click
  through GitHub or DigitalOcean. When a tool or a permission blocks you, say what blocked you in
  one line and ask him how to unblock it, not to do the work. When only a human can do a step (an
  authorisation, a payment), do everything around it and describe that one step in plain words.
- **Cost him the least.** Rate every option by Patric's time and effort and pick the cheapest for
  him. Only a real trade-off justifies another choice, and then each side gets one sentence.
- **Changes he asks for are ours end to end.** A rename, a move, a new branch or app: the agent
  makes every update that follows. "Let me know and I'll make all updates", never "then update the
  config files".
- **Write for the product owner.** Plain words, short, what it means for the product. No git,
  infrastructure or configuration vocabulary unless he asked for it.
- **One number per question, the register's.** A question to Patric carries its
  `docs/open-questions.md` number in chat too, never a fresh "1."; numbers keep counting across
  sessions. Each question is phrased so that a yes, a no or a pick answers it, with the smaller
  option named.

## Raising issues

Patric is the strategist and product owner. Agents find problems; Patric decides.

- Raise an issue when you find it, not at the end. Do not sit on it and do not resolve it yourself.
- Raise it as a **numbered list whose numbers are the register's** (`docs/open-questions.md`). Each item: the issue in one or two sentences, an optional suggested solution, and whether it needs approval. Patric answers by number.
- **Tag every item with the part it concerns**, in brackets first: `[core]`, `[crm]` (any adapter), `[crm-vitec]`, `[crm-mspecs]`, `[client-wordpress]`, `[client-lovable]`.
- **One number per question, for good.** `docs/open-questions.md` is the register: a question gets the next number there before it is asked, chat refers to that number, and Patric answers by number in any conversation. Numbers are never reused; an answered question moves to `docs/decisions.md` and leaves the register.
- Once an item is approved, act on it. That includes updating `docs/strategy.md`: agents may change the strategy when the change is approved, and note it in `docs/decisions.md`.

## Definition of done

1. The enforced checks are green, and the files you touched have no warnings.
2. The acceptance report is updated if an acceptance criterion's status changed.
3. A `docs/decisions.md` line exists for any structural choice.
4. Strategy §9 is updated if the phase moved.
