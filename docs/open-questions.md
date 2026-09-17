# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 29.

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

## 27. `[core]` One gate for everyone, agent or human

The requirement: whoever changes the code, the same steps, nothing bypassed. Proposed: every change
goes through a pull request; GitHub refuses the merge until the enforced checks are green;
`staging` updates itself on every merge into it; someone confirms on staging; a pull request into
`main` merges the same way, and production updates itself from `main`, health-gated. An agent
merges on Patric's word, a dev with the merge button; the path is identical. What it needs:
GitHub's branch protection switched on for `staging` and `main` (a one-time setting by someone
with admin rights on the repository, about two minutes, not reachable from an agent session), and
production set to deploy on merge (one "allow" from Patric). Say yes, or say what differs.

## 28. `[core]` Funnel everything to the sites now, or wait for the plugin's field list

Today the data the sites receive holds identity and relations only; every other Vitec field waits
for the field list Patric chose on 2026-09-16 (the WordPress plugin's universal model, next-steps
item 2), so a site cannot see `marketing.isPublished` or `status` yet. The principle says
everything Vitec returns reaches the sites. Smaller option: map everything now, mechanically
(every Vitec field, snake_case, the CRM's nesting, next to the spine; nothing chosen, nothing
judged), and lay the plugin's field names on top when the list arrives. Or wait for the list.
Pick one.
