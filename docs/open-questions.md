# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 28.

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

## 26. `[crm-vitec]` Embed the agents in estates and projects?

Confirmed against Connect on 2026-09-17: the adapter asks for every estate extension except
`primaryAgent` and `secondaryAgent`, which embed the agent's own `AdvertisingUser` record, and a
project's only extensions are those two; `$estate` adds nothing. Point 7 of the proposal, approved,
keeps the agents out: they are their own items, referenced by `agent_ids`, so a change to an agent
does not rewrite every estate of theirs and ring every site. Nothing is missing from Core; only the
duplicate is left out. Say if you want them embedded anyway, and the mirror carries
`extensions.primary_agent` and `extensions.secondary_agent` on estates and projects at that cost.

## 27. `[core]` `[crm-vitec]` `[client-wordpress]` `[client-lovable]` How previews work end to end

Facts, from `docs/inputs/vitec/advertising-preview.md` and the estate model. An estate has
`marketing.isPreview` and `marketing.isPublished`. Vitec's estate list holds marketed estates only,
so an estate in preview reaches Core through its webhook or through a fetch the preview triggers.
Vitec offers a preview landing page: when the agent clicks preview in Express, Vitec calls two GET
endpoints at the partner, `init?customerId=&estateId=` answered with `{url, state}` and
`verify?customerId=&estateId=&state=` answered with `{isReady, url, errorMessage}`, polls `verify`
until ready, then shows `url`. Vitec's own validation: show a preview only while the status is
AssignmentAttempt, AssignmentAccepted, SoonForSale, Coming or ForSale; a marketed estate shows its
normal page.

Proposed, smallest first:

1. Core carries the estate like any other, done by the answer to 18; its status and marketing
   flags reach `data` with the model (next-steps item 2).
2. The site's preview link. The item exists on the site as a draft. `?preview=<token>` shows it
   when its status is one of Vitec's five and it is not marketed. Before rendering, the site pulls
   `/v1/changes` from its cursor, one request and usually empty, so the page shows what Core holds
   now: the "update before showing" you asked for, with no new Core capability. The token: an
   HMAC of the remote id with the site's bell secret, so the site checks it with no round trip and
   the link is unguessable. Needs nothing in Core.
3. Vitec's landing page, later. The adapter answers `init` by putting the estate on the fetch list
   with webhook priority and returning the site's preview URL, and `verify` with `isReady` once the
   record is fetched and every subscriber of the tenant has pulled past its `seq`. Needs a preview
   URL template per subscriber (`preview_url`, say `https://site/fastighet/{remote_id}/?preview={token}`),
   a contract addition, and Vitec pointed at Core's adapter endpoints.

Questions: start with 2 now and add 3 after, or both together? Is the HMAC token the unique link
you mean? Needs approval: 2 sets a client rule and 3 adds to the contract.
