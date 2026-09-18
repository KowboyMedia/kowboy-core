# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 41.

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

## 16. The plugin's license, now that Action Scheduler is bundled

Action Scheduler is GPLv3, and a plugin that ships it is GPL-derived, as WordPress plugins normally
are. The plugin header has no `License:` line. Suggested: `License: GPL-3.0-or-later` in
`clients/wordpress/core-client/core-client.php`. Your call; nothing else depends on it.

## 39. Link a site from its tenant's page by domain

`[core]` `[client-wordpress]` Your journey of 2026-09-18: make the tenant, add its CRM connection
on the tenant's page, have the client install and activate the plugin, then click "Link site" on
the tenant's page and type the site's domain. Proposed mechanics: Core calls the plugin at that
domain over HTTPS with a one-time code, the plugin fetches its token from Core (Core's address is
built into the plugin, never taken from a request) with that code, and nothing is typed on the
client side. Before linking, Core shows what answered at the domain (site name, plugin version,
linked already or not) and the link is made on a second click, so a mistyped domain links
nothing. "Relink" issues a new token and retires the old one; "Unlink" revokes it, and the site
keeps its content but stops updating. Only `https://` domains, never private addresses. Needs
approval: the contract gains one endpoint (the site fetching its token with its code), the plugin
ships Core's address, and sites and connections are made from the tenant's page while the global
lists stay as read-only overviews. Smaller option: keep today's token paste, but make sites from
the tenant's page.

## 40. Lovable sites: the same link, or the token as a setting

`[client-lovable]` Lovable sites are Kowboy's own. Smaller: the token stays a setting of the
Supabase project (nothing to build). Or: the same link flow through a function endpoint, so a
Lovable site is linked from the tenant's page like a WordPress site. Say which.
