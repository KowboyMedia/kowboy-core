# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 26.

## 2. Protected paths created by an agent

`schemas/`, `acceptance/` and `golden/fake/` did not exist before. CODEOWNERS now protects the
first two, so this is the one time they are created without a prior review. They need your read.

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

## 18. `[crm-vitec]` What Vitec answers for an estate it no longer publishes

The read-only probe of 2026-09-17 (`scripts/vitec-probe.ts`, with the test account) settled
paging, ids and dates (`decisions.md`, 2026-09-17). It could not settle this: the estate given as
withdrawn from the website, `obj31529_2059181530`, is one Vitec still publishes. It is in the
published list (`GET Advertising/Estate/M31529`, 648 rows), and its record says
`marketing.isPublished: true` with status `Sold`, changed 2026-09-10. Of the 648 listed estates,
420 are `Sold` and 189 `AssignmentWithdrawn`; a sample of 41 records had none unpublished.

Why it matters: the adapter tombstones a record only when Vitec answers 404 by id, and a `Remove`
notification and the daily comparison both end in that fetch. If Vitec answers 200 for an estate it
no longer publishes, that estate would stay live in Core and on every site. Until this is settled
the adapter keeps the 404 rule and nothing is built on a guess.

Needed: the id of an estate whose website publishing is switched off in Express (Vitec's
`marketing.isPublished` false), or the id from a `Remove` notification, in `VITEC_ESTATE_ID`; then
`npm run build && node dist/scripts/vitec-probe.js` prints whether it is listed and what its record
says. Suggested, should Vitec answer 200: an estate that is not in the published list, or whose
record says `isPublished: false`, is gone, which the daily comparison and a `Remove` fetch would
then apply. Needs approval: it decides what a tombstone means for Vitec.

## 25. `[core]` The app cannot verify the managed database's certificate as built

The connection string App Platform binds as `DATABASE_URL` carries `sslmode=require`. Under that
mode node-postgres (`pg-connection-string` 2.14) opens TLS and verifies the server certificate
against Node's trust store; a Standard Edition cluster is signed by DigitalOcean's own CA, the one
the panel offers as "Download CA certificate", so the first connection from `web` or `worker`
fails verification and the app never comes up. Not tested against a cluster, read from the
DigitalOcean documentation and the library.

Blocked: Phase 1b, the deploy. Suggested, the smaller change that keeps verification: a variable
`DATABASE_CA_CERT`, bound to `${db.CA_CERT}` in the spec, read by the engine's pool and the Vitec
adapter's own pool as `ssl: { ca }`. Alternative with no code: `uselibpqcompat=true` appended to
the URL makes `require` mean what it means in libpq, encrypted but unverified. Needs approval: it
touches the engine's configuration and the adapter's store.
