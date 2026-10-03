# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 129 (124 was asked in chat only on 2026-10-03 and answered the same day; 116 to 118 were used by the handbook sessions of 2026-09-29 to 2026-10-03, 116 in chat only; 75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 127. `[client-wordpress]` A CRM agent's text or portrait changed on the site: later or now

- 2026-10-03 · The look-ahead of item 22 (`docs/site-records.md`): once the CRM carries a person,
  the site cannot change their page, because a CRM record is read-only on the site and a pull
  would overwrite an edit. A per-field override on CRM records would let a site keep its own
  text or portrait over the CRM's through every pull. Blocked: nothing; it is the item after
  typed records, if at all.
- Smaller option: later (a), a "Later" item in `docs/next-steps.md`. Else now (b), inside item
  22, which doubles it. Answer a or b.

## 128. `[client-wordpress]` Default: the choices inside typed records on the site

- 2026-10-03 · The Default for item 22 under 125 (a), taken unless Patric disagrees: the form
  holds the fields the Kowboy 2026 pages show and no other, an office's address as one field
  typed as it is to be shown; a typed agent may belong to any
  office the site holds, CRM or typed, and shows among that office's staff; the typed order
  number places the agent among the CRM agents by the one rule, and without one the agent sorts
  after the numbered ones by name; administrators and editors add, edit and delete typed records
  while CRM records stay locked for everyone; WordPress's draft status means "not shown on the
  site". Blocked: nothing.
- Smaller option: these choices as they stand; the alternative to each is named in
  `docs/site-records.md`. Reply only if you disagree: no, and which choice.

## 125. `[client-wordpress]` Offices and agents typed on the site: where they live

- 2026-10-03 · Patric asked for offices and agents added in the WordPress admin that no CRM
  carries. `docs/site-records.md` lays out the two homes with their trade-offs. (a) On the site:
  the site's own records in the same post types and the same index as the CRM's, editable in the
  Kowboy Estates menu, never touched by a pull, listed and ordered by the one rule that already
  applies to CRM agents. (b) In Core, as a source of its own: a manual adapter whose records every
  site and client of the tenant pulls, typed in Core's panel by Kowboy, or typed in the WordPress
  admin and sent to Core through a new write contract. Blocked: the whole feature.
- Smaller option: (a), recommended; plugin only, no protected path, the portrait from the media
  library, an edit visible at once. (b) costs a new adapter, a portrait host Core does not have,
  and, for typing in the WordPress admin, a new contract with approval; it gives one picture in
  Core and the same people on every site of a brokerage. Answer a or b.

## 126. `[client-wordpress]` A typed agent the CRM later carries: who goes

- 2026-10-03 · A typed agent and a CRM agent are two records, and the site never matches them on
  its own, so when the CRM later carries the same person both show until one goes. Blocked:
  nothing; waits on 125, and the smaller option is built unless (b) is picked.
- Smaller option: nothing automatic, a person deletes the typed agent in the admin (a). Else:
  when a CRM agent arrives with the same e-mail as a typed one, the site hides the typed agent and
  the typed agent's old address sends the visitor on to the CRM agent's page (b). Answer a or b.

## 123. `[crm-vitec]` A whole-day viewing: what the CRM sends, so the page shows no time

- 2026-10-03 · Patric's list says a viewing has an "entire day" flag that hides the time. Vitec's
  viewing carries `id`, `startsAt`, `endsAt`, `comment`, `isDigital`, `isSelfRegistrationEnabled`
  and `isProjectViewing` (field tables, `viewings[]`); no such flag. The page now treats a viewing
  from midnight to midnight, or starting at midnight without an end, as a whole day and shows the
  date alone. Blocked: nothing; a whole-day viewing with other times would show those times.
- Smaller option: keep the midnight rule (a). Else: name the field (b), and the adapter maps it.

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

## 122. `[crm-vitec]` The area texts ("Område": läge, kommunikation, service, parkering) are empty for every record on the staging site

Every property and every area on the staging site (Vitec test office M31529) carries `surroundings`
with all five texts null, so the "Område" section of the property page and the texts of the area
pages never show (seen 2026-10-03 on Vildgåsvägen 19B and the area Dalhem through `?debugpl`).
The master site shows them. Either the advertising payload does not carry them (then the
adapter needs another Vitec call, like the documents of question 94) or the mapping reads the
wrong field. Default: the adapter session checks Vitec's payload for the area texts and maps
them; until then the section stays hidden, as it does now. Smaller: leave them out.

## 121. `[client-wordpress]` The staging site's WordPress login, so a session can put a change on it

The staging WordPress site (the app "v4-staging" on Cloudways) changes only when a session runs
`scripts/deploy-site.mjs` against it with the site's admin login, or when a `v*` tag publishes a
release to the update channel. A push to the `staging` branch alone changes nothing on the site
(2026-10-03: the punch list was in staging for half an hour and the site showed none of it). The
login lives in Cloudways, not in the agents' environment. Default: the login goes into the
project's cloud environment as `SITE_URL`, `WP_USER` and `WP_PASSWORD`, and a session puts every
change on the site right after saving it to staging. Smaller: Patric runs the script himself, or
asks for a release tag each time.

## 120. `[core]` The Cloudways token: the pair answers "incorrect credentials"

After the token move of 2026-10-03 (question 87, closed), `POST /api/v1/oauth/access_token` with
`CLOUDWAYS_EMAIL` and `CLOUDWAYS_API_KEY` answers 403 "The user credentials were incorrect", which
is not the earlier "insufficient_scope" (a valid but limited token) but a refusal of the pair
itself: the key is not the one Cloudways shows for that email, or the email in the environment is
not the account's. Nothing waits on it today: the staging site is installed through its WordPress
admin by `scripts/deploy-site.mjs`, not through Cloudways' API. In the Cloudways console, under
the account's API settings, copy the API key as it stands (or regenerate it), save it as
`CLOUDWAYS_API_KEY` in the session environment, check that `CLOUDWAYS_EMAIL` is the account's
sign-in email, then say "saved".

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
