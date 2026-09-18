# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 46.

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

## 41. Which id the `/objekt/<id>` links carry

`[client-wordpress]` The stable link `/objekt/<id>` resolves the property by id and answers 301 to
its current permalink (`/objekt/<slug>-<id>/`, SRS Appendix A). Core's id for a Vitec estate is
Vitec's own (`OBJ31529_1738853171`); Vitec's payload also carries a `referenceId`. Say which one
the links out there use (advertisements, e-mails, the old sites). Smaller: Vitec's id, which Core
already keys on.

## 42. A removed listing's `/objekt/<id>` link

`[client-wordpress]` A listing gone from the CRM's list has no page. Its old links can answer 410
Gone (search engines drop it, visitors see the site's not-found page) or 301 to the listings
archive (visitors land on what is for sale, search engines treat it as a soft not-found). Smaller
and cleaner for search engines: 410.

## 43. The sitemap's change date

`[client-wordpress]` `[client-lovable]` The SRS (§7.1) says the sitemap's `lastmod` and any
"updated" date come from the CRM's change time only, never from a site's write time; the plugin
does that today. You now want a new date on every update. The two agree except when Core changes a
page without the CRM changing the record (a rules change, a recompute): then the CRM's time stands
still while the page changed. Proposed: the visible "updated" date stays the CRM's time, and the
sitemap's `lastmod` becomes the time the site wrote the page, which happens only when its content
changed. Yes amends SRS §7.1 (strategy §12); no keeps `lastmod` at the CRM's time.

## 44. Who fills `display`

`[core]` `[client-wordpress]` `[client-lovable]` The SRS has Core computing every `display.*`
string (prices, areas, address lines) from human-written ledger entries, once for every site, and
the envelope carries `display` today, empty. "Core parses no CRM data" reads as: the site computes
`display` at sync time from the payload, in each client, so WordPress and Lovable hold the same
formatting twice. Say which: (a) Core, from ledger entries; (b) the site, at sync time. (b) follows
the rule; (a) is less code.

## 45. Slugs for office, project and association

`[client-wordpress]` Given 2026-09-18: property `<status>-<area name>-<street address>-<id>`,
agent `<first name>-<last name>-<id>`, area `<municipality>-<area name>-<id>`, every entity ending
in `-<id>`, set by WordPress. Office, project and association are not given. Smaller: `<name>-<id>`
for all three.
