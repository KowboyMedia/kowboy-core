# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 115 (75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 52. The pairs for the Vitec mapping: no longer needed for the mapping; what remains is Vitec's golden masters

`[crm-vitec]` Patric's plan of 2026-09-19 (a read endpoint on a client site running the old
plugin, plus its Vitec key pair, fetched as pairs and mapped by evidence) was overtaken the same
day by Gate 2: `docs/field-tables.md` names every universal field's Vitec source,
`adapters/vitec/mappers.ts` copies and renames by those tables, and `display` comes from the
approved ledger entries. The mapping needs no evidence from the old sites, and taking anything
from the old plugins is a hard rule against (AGENTS.md). What 52 still delivered is Vitec's golden
masters (Gate 3, AC 1) and the comparison against the old sites (AC 28). Close 52 and take
Vitec's golden masters from the test account's real records on staging instead: an agent keeps a
representative set as `golden/vitec/` cases (payload, universal, display) for Patric's approval,
the protected path's gate; the parity inventory stays a human-supplied list (strategy §10, AC 28)
checked against Core's data. Smaller: yes, close 52 and take them from the test account. Or keep
the pairs.

## 54. Vitec on the test account: five things only a person in Vitec can set up

`[crm-vitec]` Core copies what Vitec sends, so nothing in Core waits on these; the sites'
templates do. One estate per case, set by a person in the Vitec test account, read off staging by
an agent: (a) a new-build project's homes appear in the marketed list with their `projectId`
(assumed on 2026-09-19, so a project page can list them); (b) whether the price text stays when
the price is hidden; (c) whether the area name stays when the address is hidden; (d) what status
a "till salu, visa som kommande" estate carries; (e) how each of the four bid settings shows in
`bidding`. Smaller: (a) alone now, the rest when the first client template needs them.

## 80. `[client-wordpress]` Name the first client to port, once the default set is done

Norban is not a client port: norbanmakleri.se runs the default templates of plugin v2 and v3
unchanged, so it is the reference the default set "Kowboy 2026" is ported from (Patric,
2026-09-23), and its office is the test account staging already holds. Client ports start after
the set is done (next-steps item 17), through the automated workflow of
`docs/template-porting.md`. When the set is done, name the first client by the name Cloudways
lists its site, and give its CRM login if staging does not hold that account yet.

## 87. `[core]` The two tokens are most likely in each other's slot in the session environment

Both refusals of 2026-09-23 have one likely cause. The value stored as `DIGITALOCEAN_ACCESS_TOKEN`
has the shape of a Cloudways token (67 characters, starting with `cw_`), not of a DigitalOcean
one (those start with `dop_v1_`), so DigitalOcean refuses it with "401 Unauthorized". The value
stored as `CLOUDWAYS_API_KEY` is also Cloudways-shaped but is still the limited token of
2026-09-21 (question 81), so Cloudways answers "insufficient_scope". The simplest reading: on
2026-09-21 the new, wider Cloudways token was saved into the DigitalOcean slot by mistake, and the
DigitalOcean token was overwritten by it. Neither token "stopped working"; one is in the wrong
place and the other is gone. An agent cannot test the swap itself: the session's safety rules
refuse sending a credential to a service other than the one it is stored for. In the session
environment's settings: move the value now in `DIGITALOCEAN_ACCESS_TOKEN` into `CLOUDWAYS_API_KEY`,
then make a new DigitalOcean personal access token with read and write on apps and save it as
`DIGITALOCEAN_ACCESS_TOKEN`, then say "saved"; the next session checks both.

## 90. `[core]` The display fields drafted for the default set: validate R-015 to R-019 and Vitec's golden masters

Next-steps item 18: every value norbanmakleri.se shows that `display` did not carry was drafted
on 2026-09-24 from the site's pages against the same records on the test account. Five entries,
each implemented in the engine with a test and shown by the set: R-015 the office's price wording
with a capital first letter ("Utgångspris"); R-016 the fee as an amount alone ("2 882 kr", the
card's "Avgift 2 882 kr"); R-017 floor and elevator in one line ("2 av 4, hiss finns"); R-018 the
exterior features the home has ("Uteplats finns"); R-019 an association's transfer fee and
pledge fee ("1 480 kr", "592 kr"). And `golden/vitec/`: eight cases from the test account's real
records (three properties, an agent, the office, an area, an association, a project), each with
its payload, its universal record and its `display`, proved by `acceptance/golden.test.ts`.
Everything sits in the change of 2026-09-24 for review through the protected paths. Answer "90
yes" to validate all five and the golden masters, or name the entry and what to change.

## 91. `[core]` Decimals: the master writes "1.5 rum" and "82.5 kvm", the ledger a comma

R-001 (approved 2026-09-19) writes a fraction with a decimal comma, the Swedish way: "1,5 rum",
"82,5 kvm". norbanmakleri.se writes "1.5 rum" and "82.5 kvm" on its cards and pages. The set
follows the ledger, so those cards read differently from the master. Keep the comma (smaller,
nothing changes), or amend R-001 to the master's point? Answer "comma" or "point".

## 92. `[core]` The fact tables: the master's sections against R-013

R-013 (approved 2026-09-19) lays a property page's facts out in seventeen sections (Bostaden,
Interiör, Byggnad, Våning och hiss, Energideklaration, ...). norbanmakleri.se lays the same facts
out in eleven, with other headers and other rows: Grundinformation (Upplåtelseform, Bostadstyp,
Adress without a comma, Område, Fastighetsbeteckning), Interiör (Boarea, Antal rum as a bare
number, Areakälla), Beskrivning (the selling text), Byggnad, Ventilation (its own section),
Energideklaration (with "Energiprestanda primärenergital", question 96), "Andelstal, avgifter och
insats" (Andel i förening "1.151 %", Andel av årsavgift, Månadsavgift "2882 kr" unformatted,
Kommentar, Bostadens indirekta nettoskuldsättning with its comment on the same line), Våning/hiss
(R-017's line), Driftskostnader (El, V/A, Personer i hushållet, Kommentar, Summa per år),
Föreningen (from the association's record; the set renders it as sent, R-019's fees prepared)
and Dokument (question 94). The set shows R-013's sections today plus a "Föreningen" section of
its own, so the page differs from the master in headers, order and a few row formats. Rewrite
R-013's definition to the master's eleven sections (a change to the approved ledger and the
recompute), or keep R-013 and accept the difference? Answer "master" or "keep".

## 93. `[crm-vitec]` Enumerations Vitec sends as bare strings have no name to show

Some of Vitec's enumerated values arrive as a bare id without a name: on an association
`transfer_fee_paid_by` is "Buyer", `allow_legal_person_as_buyer` is "Undetermined",
`genuine_association` is "PrivateHousingCompany"; the master shows "Köpare", "Ej angiven" and
"Äkta". The field tables copy enumerations as `{id, name}` when Vitec sends both; here it sends
the id only, and the names are in Vitec's enumeration documentation (`docs/inputs/vitec/enumerations/`).
Smaller: the adapter maps these three fields to `{id, name}` with the name from that documentation,
a field-table change for the association (approval needed); or leave them as ids and the set
shows the id. Answer "map" or "leave".

## 94. `[crm-vitec]` The documents the master lists are not in the advertising payload

norbanmakleri.se lists a property's documents under "Dokument" (Ekonomisk plan,
Energideklaration, Stadgar, Årsredovisning 2024, each opened in a viewer). The Connect payload
Core fetches carries `files: []` for the same property (Cyklopgatan 35B), so Core has no
documents to deliver and the set shows no "Dokument" section. Either the files come from an
endpoint the adapter does not read yet (a question to Vitec, or to the documentation), or the
old site kept them from another source. Smaller: leave documents out of the set until the source
is known. Answer "leave out" or "find the source", and if you know where the old site took them
from, say so.

## 95. `[client-wordpress]` Two things on the master that post to the CRM: the viewing booking and the interest form

On norbanmakleri.se a viewing has a "Boka här" button that opens Vitec's booking page for that
viewing, and every property page ends in a form ("Är du intresserad av bostaden?") that posts a
lead to Vitec. Neither is data: the booking address is built from the CRM's ids by the old plugin,
and the lead form needs a Core endpoint that forwards to the CRM (Connect has one,
`POST .../interest`), an adapter capability nothing in Core offers yet. The set shows the viewing
without a button and no form. Smaller: leave both out of the set now and plan the lead endpoint as
its own item. Answer "later" or "now".

## 96. `[crm-vitec]` The master shows an energy performance value the payload does not carry

norbanmakleri.se shows "Energiprestanda primärenergital: 59 kWh per kvm och år" for Cyklopgatan
35B; the Connect payload's energy declaration for the same property has `consumption: null`, so
Core has no value. The old site took it from somewhere else. Smaller: the set shows the row only
when Core has the value (as now). Answer "as now", or say where the value comes from.

## 97. `[crm-vitec]` An agent's picture at width 1920 weighs 6 MB; the old site shows it at 1024

The field tables (approved 2026-09-19) build every image address on Kowboy's CDN at width 1920,
agents' pictures included. On the test account an agent's picture at that width is a 6 MB PNG
(the CDN scales the office's upload, a square PNG), while the same picture at width 1024, the
width norbanmakleri.se uses for agents, is 0.6 MB. On the set's pages the agent pictures are the
last to load, and a phone pays for 6 MB per agent shown. Smaller: the adapter builds an agent's
picture at width 1024 (a field-table change for `image` on an agent, approval needed), the
listings' photos stay at 1920. Or keep 1920 everywhere. Answer "1024" or "keep".

## 100. `[core]` kowboy.se has no email authentication for Postmark, so Gmail delays Core's mail (parked: Patric, 2026-09-28, "save this for later, this session is for template 2026 only"; his lead is to send from kowboy.cloud instead)

Postmark's page for the sign-in mail of 2026-09-28 says: "we recommend that you set up email
authentication for kowboy.se". Without it Gmail's server refuses Core's mail at first and takes
it minutes later (98). The fix is two DNS records on kowboy.se, which Postmark shows under Sender
Signatures, kowboy.se (a DKIM record and a Return-Path record). Only someone with access to
kowboy.se's DNS can add them; the agents have no such access.

**Patric, 2026-09-28:** mail must arrive, a delay is acceptable; "do I need to add the headers?"
The answer: yes, and they are DNS records, not headers, and nothing in Core changes. Without
them Google now takes the mail and shows it nowhere (98), so the records are what makes the mail
arrive at all, delayed or not. In Postmark, open Sender Signatures, kowboy.se, and it shows two
records (a DKIM record and a Return-Path record) to add at kowboy.se's DNS provider (Cloudflare
runs `dev.kowboy.se`'s names, most likely the whole domain); add them, then say "added". Or give
an agent a Cloudflare token limited to DNS for kowboy.se in the session environment's settings
as `CLOUDFLARE_DNS_TOKEN`, then say "token saved", and the agent adds them.

## 101. `[client-wordpress]` The site's slugs are `<connection>-<record id>`, the rule says `<status>-<area>-<street>-<id>` (parked: Patric, 2026-09-28, later)

On the staging site a property lives at `objekt/vitec-test-obj31529_2115054844/`: the plugin
names a post after its connection and the CRM's record id (`includes/store.php`), which is
enough to find it and to keep the 301 rule of 2026-09-19. AGENTS.md's permanent rule reads
`objekt/<status>-<area name>-<street address>-<id>` for a property, and the same shape for the
other kinds. Building it is the client's work (the site reads its own stored values to make a
slug, and the redirect rule already covers a slug that changes), about a day, and it changes
every address on the site once. Build it now, before the look is iterated on, or after? Answer
"now" or "after".

## 105. `[client-wordpress]` The two forms in the design: where a submission goes

"Ska du sälja din bostad?" (every page) and "Är du intresserad av bostaden?" (the single page)
post a name, a phone, an e-mail and a consent. Question 95 already asks whether the interest
form posts to the CRM. For 2026.2 the form block needs a destination now: an e-mail to an
address in the theme options (WordPress's own mail, no plugin; the interest form adds the
listing's address and agent), or the CRM per 95 when it is answered. Answer "email" or "crm".
The smaller option is e-mail, and 95 can move it to the CRM later.

**Patric, 2026-09-28:** "leave for now, they will send to CRM but we need to figure it out first
without blocking this." Open. An agent first stored submissions on the site and mailed them,
which Patric called a drift and had removed the same evening: the form is a dummy that posts
nowhere and whose button does nothing, until this is answered.

## 111. `[crm-vitec]` Documents (the marketing PDFs) into the universal model, for a listing and its association (shelved: Patric, 2026-09-28, "out of scope for this session"; picked up with the CRM mapping)

Patric (2026-09-28, answering 110 with "keep"): the documents are PDFs used for marketing, most
listings have them, they are delivered by the CDN like the images, and they exist in two places,
the listing's payload and the association's. Today the universal model carries `files[]` on a
property (the field tables, "as sent") and nothing on an association, and neither has a CDN
address: the association's payload lists `documents[]` with Vitec's own `GetFile` addresses
(behind Vitec's login), and every listing of the test office has an empty `files` list, so the
address pattern for a document on the CDN could not be read from the data; the guesses
`/r2/<customer>/<record>/<file id>.pdf` and `/r2/<customer>/<file id>.pdf` answer 400 or 500,
and norbanmakleri.se did not answer the session's fetch. Needed for the field-table lines (a
contract change, approval): the CDN's address for one document, for example the "Ekonomisk plan"
of the test office's association (file `_F_ORG_T833_8605`). Paste one document address from
norbanmakleri.se, then the adapter maps `files[]` (listing) and `documents[]` (association) to
`{id, name, category, extension, url}` on the CDN pattern, the field tables gain the lines, and
the theme's "Dokument" section lists both.
On 2026-09-23, after the release, the token stored as `DIGITALOCEAN_ACCESS_TOKEN` in the session
environment answered "401 Unauthorized" to a plain read of the account's apps, so an agent can no
longer see the live app's deployments, change either app's settings or ask for a deployment. The
release itself did not need it: live deploys itself on every change to `main`. It is needed for
the next settings change on either app (the Postmark token for live's sign-in link, question 79's
Space keys, Sentry) and for reading deployment state. Make a new personal access token in the
DigitalOcean account with read and write on apps, save it in the session environment's settings
under the same name, then say "saved"; the next session picks it up.

## 112. `[agents]` Default: after this collision, the register's numbers come from GitHub issues

Two sessions took the same numbers again: this session registered 87 to 97 on 2026-09-24 and
2026-09-28 (the tokens, the template package, the display fields, the fact tables, the
enumerations, the documents, the forms, the energy value, the agent picture) while the agent-setup
session registered 87 to 92 on 2026-09-27 (the DigitalOcean token, the shared rules, the reply
protocol, the hooks, the cooperation rules, the units of work). Both meanings stand, as the rule
says, and the register check reports 90 and 92 as used twice (87 and 89 to 91 of the other session
are answered and in the decisions). The agent-setup item in `docs/next-steps.md` planned the way
out for exactly this case: each question becomes a GitHub issue and takes the issue's number, and
the register file stays the readable view. Default: the next session makes that move (the open
questions become issues with their texts, the file lists them by issue number, `check-register`
reads the issues' numbers). Smaller: keep counting in the file and accept collisions. Answer
"no" to keep the file.

## 113. `[agents]` How the handbook reaches each repository: copy, fetch or managed

Claude Code reads instructions only from files inside the repository it works in, or from
server-managed settings on Team and Enterprise plans. Its `@import` takes no web address; a cloud
session's GitHub access reaches only the repositories attached to it, so a private handbook cannot be
read from another repository's session; public files on raw.githubusercontent.com are reachable under
the default network level (Claude Code documentation, read 2026-09-29). That leaves three ways.
**Copy** (recommended): the sync action keeps a copy in each repository; versioned with the code,
read by every agent tool, reloaded after compaction, zero human steps once the token exists; cost:
one save per repository per handbook change. **Fetch**: the handbook repository is made public and a
session-start hook prints the rules live from GitHub; no copy, no token; cost: the rules are public,
the playbook phases stop loading by themselves as skills, and the hooks and settings still need one
copy per repository. **Managed**: only on a Team or Enterprise plan, an Owner pastes the rules into
Admin settings and every session, cloud included, gets them within an hour; cost: every rule change
is a paste by Patric, and skills cannot travel that way. Whatever the choice, every repository keeps
its own `CLAUDE.md`, `AGENTS.md`, memory files, hooks and settings.

## 114. `[agents]` The name of the shared setup, its repository, its file and its tag

"agents" is too generic (Patric, 2026-09-29). Recommended **handbook**: the repository
`KowboyMedia/handbook`, the shared rules file `HANDBOOK.md` (replacing `AGENTS-shared.md`), the
tag `[handbook]`, and "the handbook" in chat; it is the established name for the repository that
says how a company works, and it pairs with `PLAYBOOK.md` (the procedures) and each project's
`AGENTS.md` (the standard name, kept). Alternative **ranch**: the brand word, on-brand and opaque to
anyone new. Renaming the repository itself is the one step only Patric can take (repository
settings cannot be changed from a session); GitHub keeps the old address working; everything else
an agent renames in one pass.
