# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 27.

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

## 18. `[crm-vitec]` What a record by id returns for an estate taken off the website

The probe of 2026-09-17 settled paging (pages count from 0, `count` is the page count) and that a
made-up id is 404 (`docs/decisions.md`). What remains is what `GET .../Estate/{customerId}/{id}`
returns once an estate is taken off the website: a 404 tombstones it, a 200 keeps it on every site.
The estate given as withdrawn (`VITEC_ESTATE_ID`) is not withdrawn according to Connect: it is in
the list, its `marketing.isPublished` is true and its status is `Sold`, so it answers 200 like any
listed estate. Needed: an estate in the test account that is actually unpublished
(`marketing.isPublished` false), or one unpublished for the test; then the probe again (next-steps
item 5). Smaller option if that cannot be arranged: keep the design as built, where only a 404
tombstones.

## 26. `[crm-vitec]` Vitec's preview flow, and what happens to an estate taken off the website

Two things Vitec can call at Kowboy, both documented in `docs/inputs/vitec/`:

- **Notifications** (webhooks): the URL is ours to choose, and it is
  `https://<app domain>/v1/hook/vitec/webhook/<token>` per app. Nothing to decide.
- **Preview** (`advertising-preview.md`): a broker previews an estate on the website before it is
  advertised. Vitec calls two GET endpoints we provide (`init` and `verify`, with `customerId` and
  `estateId`) and expects back the URL of the estate's page on the site. That needs Core to carry
  estates that are not published for the website, and to know each estate's page URL on a site.
  None of it is built.

Decide whether the preview flow is wanted. If not, the smaller option settles question 18 as well:
an estate Vitec does not publish for the website is gone for Core, so a fetch that answers 200 with
`marketing.isPublished` false is treated like a 404 and the sites drop it. If yes, unpublished
estates are carried with their `marketing` flags, the sites decide what to show, and the two
endpoints plus the page URL become a design proposal of their own.
