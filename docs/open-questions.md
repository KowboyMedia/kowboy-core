# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 38.

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

## 29. `[core]` The admin panel MVP

`docs/admin-panel.md` describes it: eight panels (overview, tenants and sites, connections,
adapter panels, items, events, a test panel that runs requests, settings), server-rendered inside
the `web` process behind the admin secret, adapter panels living in each adapter's own folder and
reaching the shell through one additive field on the adapter API. Answer: yes to build it as
described, or say what to change. The adapter API field is the one protected change.

## 30. `[core]` The display rules come from the reference site, as one approved PR

The templates print `display.*` strings that Core computes (SRS §7), and no rule exists yet:
`rules-ledger/` is protected and does not exist. Everything norbanmakleri.se shows is such a rule:
"2 995 000 kr", "2 rum", "57 kvm", "Avgift 3 785 kr", "Visning Mån 28 sep kl 17:30", "Till salu",
"Bostadsrätt", "Byggnadsår 1937-1938", "Våning 4 av 4". Suggested: an agent derives each rule by
comparing the site's output with the same object's payload (the session's Vitec credentials are
Norban's office), writes the ledger entries and the golden masters (`golden/vitec/`, payload →
display for the objects on the site), and you approve that one pull request. Grouping and labels
(which fields sit under "Interiör") stay in the templates as layout. Yes, or say what to change.

## 32. `[client-wordpress]` The Cloudways key is rejected

The API key in the session environment answers "invalid credentials" for info@kowboy.se. Check the
key under Cloudways → Platform API, and name the app (or apps) that should get the new plugin.
Until then the plugin is proven on a local WordPress only.

## 33. `[client-wordpress]` What the templates cover

The plugin renders the for-sale list, the sold list, the cards, the object pages and the agent
pages, all of which norbanmakleri.se shows and the comparison covers. Office, area and association
pages have no reference on the site, so they are built from the v4 package but not compared.
Project pages are not built. The Neve theme's header, footer, page hero and the lead, interest and
booking forms are left to the site. Yes, or name what to add.

## 34. `[core]` The grouped sections are a display rule, not template layout

The object page prints grouped facts ("Grundinformation", "Interiör", "Byggnad", "Föreningen",
"Dokument" …), each a label and a text. If the grouping and the labels are template layout, every
client repeats them, and the Lovable sites would drift from WordPress. Suggested: `display.sections`
is one rule in the ledger, a list of `{title, items: [{label, text}]}`, and every template prints
it as it comes. That amends the "grouping and labels stay in the templates" line of question 30.
Yes (Core carries the sections, the smaller option for the clients), or no (each client groups).

## 35. `[client-wordpress]` Two front-end libraries bundled with the plugin

The reference site's cards and galleries are Swiper (loaded from a CDN) and its hero is
ken-burns-carousel. Matching the output needs both. Suggested: bundle both files in the plugin,
about 150 kB, no CDN call at run time, no other dependency. Yes, or say no and the hero and
sliders become plain images.

## 36. `[client-wordpress]` Should the URLs match the reference site too

The site's addresses are `/objekt/till-salu-lund-centrum-flormansgatan-8-obj5pjjqw…/` and
`/maklare/sara-gustavsson-han99da…/`; the plugin's are `/objekt/<connection>-<id>/`. Matching
them keeps search rankings and links on a migrated site, and is one slug rule in the ledger
(part of question 30). Yes (the slug rule), or no (content only, the smaller option).

## 37. `[core]` Image addresses are a display rule

The site shows every picture from Kowboy's CDN, `cdn-realestate.kowboy.se/r2/<office>/<object>/<image>_1920.jpg`,
built from ids the CRM payload carries. Question 6 left images open. Suggested: one display rule
builds those addresses from the payload, so `display.images` is what the templates print and no
client knows the CDN's layout. Yes, or say where the addresses come from instead.
