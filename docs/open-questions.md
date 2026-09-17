# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 25.

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

## 18. `[crm-vitec]` What a test account settles

Built from the documentation alone (`docs/inputs/vitec/`), three things are unverified: whether
list paging starts at 0 or 1 (the lister tolerates both); what `GET .../Estate/{customerId}/{id}`
returns for an estate withdrawn from the website (404 tombstones, 200 keeps the record with its
status); and whether a `Remove` notification's record is still fetchable. Needs Vitec test
credentials: `scripts/vitec-probe.ts` answers the first two the moment they exist (next-steps
item 5).

## 20. `[core]` The restore design, built as AC 41

Every engine start moves the item sequence 1,000,000,000 ahead; every worker start runs the
adapters' catch-up and id comparison. A restored database therefore serves nothing below a
subscriber's cursor except what is written after the restore, and Core converges within minutes.
Built with the criterion and its tests on 2026-09-17 at your request; the protected paths touched
are `acceptance/` and strategy §7.2, §10 and §13. Approve, or amend.

## 21. `[core]` Lifecycle events never reach the worker when web and worker are separate processes

`POST /v1/admin/event` runs in the web process and calls the lifecycle handlers registered in that
process; adapters start only in the worker, so in production `connection_added`, `offices_added`
and `resync` reach nobody. The tests pass because they run both roles in one process. Suggested:
the admin endpoint writes the event to a small `lifecycle_events` table and the worker's tick
drains it and calls the handlers; engine-internal signalling between the engine's own processes,
not a CRM queue. Needs approval; blocks onboarding on the platform.

## 22. `[core]` Bells during a bulk load

Bells are already batched per subscriber: the first change after a quiet period rings at once,
further changes within 10 s collapse into one bell (`BELL_THROTTLE_MS`, strategy §5.2). A 10,000
record load rings about once per 10 s while it runs, and the client pulls pages of 100 either
way. Is that the batching you meant, or should the window be longer?

## 23. `[core]` A rebuild guard after a restore

A `forcerefresh` sent in the minutes between a restore and the adapters' convergence would delete
what Core has not re-fetched yet. The runbook says do not send one until the checks are green. The
alternative is Core refusing `after=0` pulls for some minutes after every worker start, which is
a pause after every deploy. Suggested: the runbook, no guard.

## 24. `[core]` Blue/green for the database

A standby node on the managed cluster gives automatic failover on the same sequence, at about twice
the database price; that is the blue/green that helps, and only against infrastructure failure. A
second Core kept in sync from the CRM does not help: a bad mapping or a bug reaches both copies at
once, and the remedies for bad data are recompute from `raw` (§7.3) and purge-and-resync from the
CRM (§7.2), which need no restore at all. Yes or no on the standby node.
