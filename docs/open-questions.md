# Open questions

Everything an agent could not settle from the Concept, the SRS, the strategy or the rules ledger.
Each one names what is blocked and what the smaller option would be, so answering is quick.
Answered questions move to `decisions.md` and are deleted from here.

## 1. Gate 2 cannot be held yet: there is no data model to approve

`docs/field-tables.md` no longer proposes a model. The invented fields are gone, the contract is
the structural spine, and the schemas say `INCOMPLETE`.

Defining the real model needs the CRM data models (question 7), the parity inventory and the rules
ledger. Until then Gate 2 has nothing to approve, and building the clients or the adapters against
this contract means building against identity and references only.

## 2. Protected paths created by an agent

`schemas/`, `acceptance/` and `golden/fake/` did not exist before. CODEOWNERS now protects the
first two, so this is the one time they are created without a prior review. They need your read.

## 4. Where an adapter keeps its own tables

The strategy says an adapter owns its queue, dedupe and retries "in its own tables", and that
adapters know nothing about engine storage. The adapter API offers no database handle, so a real
adapter would open its own connection pool to the same Postgres. The fake adapters keep their
fetch list in memory, so nothing was decided by accident. Two options when Vitec is built:

- **a.** The adapter opens its own pool from `DATABASE_URL` and owns its migrations. No change to
  the adapter API.
- **b.** The adapter API gains a scoped SQL handle for adapter-owned tables. That is an adapter API
  change, which needs approval.

Option a is smaller and needs no approval, so that is the default unless you say otherwise.

## 5. There are no business rules, and none can be written yet

`engine/rules/run.ts` computes nothing. It guarantees `display` exists and gives rules one place to
live. Earlier it formatted prices, areas, room counts, addresses and slugs; all of that was
invented from the SRS's illustrative example and has been removed.

A rule needs two things first: a field to compute over, and a ledger entry saying what the output
should be. `rules-ledger/` is protected and empty, so nothing can be written until an entry exists.

## 6. Images, when the model is defined

Kowboy serves images through a separate CDN app. The SRS says images are CRM CDN URLs with a sort
order (§6.6), but there is no image field in the contract today and none will be added on a guess.
When the model is defined, say whether Core carries image URLs at all or leaves them out entirely.

## 7. Vitec's rate limits are not documented

The documentation is fetched (`docs/inputs/vitec/`), and it says nothing about rate limits: no
limit, no headers, no guidance beyond "cache what you fetch". The adapter's fetch pacing (strategy
§5.3, AC 29) needs a number. Ask Vitec, or take a conservative default such as a few requests per
second per customer and raise it when Vitec says more. Until then the adapter is built with a
configurable pace and no assumed limit.

## 8. Phase 1 cannot exit without the platform

Phase 1's exit is a real PR → staging → production deploy, and AC 18, 24, 27 need a live
environment. The app is built to run on DigitalOcean App Platform with managed Postgres, but
nothing is deployed. Phase 1 is split in the strategy into Foundation (done) and Deploy (waiting
on you).

## 9. The adapter API cannot stamp an adapter's own events

`logEvent(type, fields)` writes a row with no correlation id and no entity reference, so an
adapter's own events (a webhook arriving, a CRM call and its timing) cannot be linked to the write
they caused. `ingest` does take a correlation id, so the chain works from the fetch onwards, and
the fake adapter proves it.

AC 16 asks for one query returning the whole timeline **across webhook, fetch, CRM call, write,
bell and pull**. Meeting it fully needs one added argument:

```ts
logEvent(type, fields, context?: { correlationId?, connectionId?, datatype?, remoteId? })
```

That is an adapter API change, so it needs approval (E3). It is additive and breaks no caller.

## 16. The plugin's license, now that Action Scheduler is bundled

Action Scheduler is GPLv3, and a plugin that ships it is GPL-derived, as WordPress plugins normally
are. The plugin header has no `License:` line. Suggested: `License: GPL-3.0-or-later` in
`clients/wordpress/core-client/core-client.php`. Your call; nothing else depends on it.
