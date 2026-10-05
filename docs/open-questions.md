# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 153 (124 was asked in chat only on 2026-10-03 and answered the same day; 116 to 118 were used by the handbook sessions of 2026-09-29 to 2026-10-03, 116 in chat only; 75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 150. `[core]` Where should the forms live?

- 2026-10-05 · Patric, after answering 146: "I am still not sure this should live in core, the
  more I think about it, it's a separate app, but it can live in the same repo. List pros and
  cons." Words used: **a program** is a piece of software that runs on its own at the host
  (DigitalOcean); Core runs as two today, one that answers the sites, the CRM's notifications and
  the admin area, and one that fetches from the CRMs and tells the sites what changed; **a CRM's
  code** is its adapter, where the calls that send a form to that CRM live whichever option is
  picked.
- The three options:
  - a) **Inside Core**, in a folder of its own: Core's program that answers the sites also
    answers the visitors' forms.
  - b) **A separate app in Core's repository, using Core's database.** A third program of its
    own, started from Core's one entry point as a third role, so the rule that only that entry
    point uses both the engine and the CRMs' code still holds. The hosting sends the forms' part
    of Core's address to it, so no new address is needed. It reads the sites, the homes and the
    CRM logins from Core's database and sends through each CRM's code; Core's two programs carry
    none of it.
  - c) **A separate app with its own data**: its own database and its own copy of each
    brokerage's CRM login, typed into its own admin area; it reads the homes from Core the way a
    site does.
- Pros and cons:

  |                              | a) Inside Core                                                                                  | b) Separate app, Core's database                                                                                                                       | c) Separate app, own data                                                                     |
  | ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
  | Core itself                  | the forms' web door, bot check and log sit in the program that answers the sites                | nothing of the forms in Core's two programs                                                                                                            | unchanged                                                                                     |
  | The brokerages' CRM logins   | one copy, in Core                                                                               | one copy, in Core's database; the forms program holds the same key Core reads them with                                                                | a second copy, in a second admin area: two places to change a password                        |
  | Visitors and bots            | reach Core's own program, beside the sites' updates, the CRM's notifications and the admin area | reach only the forms program; a flood or a fault there leaves the sites' updates and the admin area alone                                              | as b                                                                                          |
  | Health, alerts and errors    | Core's, as today                                                                                | a second place to watch, or a card for the forms program in Core's admin area (a line to ask)                                                          | a second place                                                                                |
  | Running cost                 | nothing new                                                                                     | one more program on staging and one on live, DigitalOcean's smallest size: $5 a month each (DigitalOcean's App Platform pricing page, read 2026-10-05) | as b, plus its own database                                                                   |
  | Database connections         | none new                                                                                        | two more programs on the one database cluster that staging and live share, where staging's worker already ran short once (known bug 5)                 | its own database                                                                              |
  | To build                     | the least                                                                                       | about the same code as a, plus its start, its share of Core's address and its entry in the hosting setup                                               | the most: its own admin area, its own register of sites and logins, a key on Core's interface |
  | Tied to Core                 | it is Core                                                                                      | reads Core's tables, so a change there must keep it working (the shared tests catch that); released with Core                                          | only through Core's interface, like a site                                                    |
  | A site Kowboy does not build | later: Core must first be able to hold a site that has no bell address (146, item 5)            | later, the same                                                                                                                                        | possible, at the costs above                                                                  |
  | Rules that change            | none                                                                                            | a new top-level folder, the layout in `AGENTS.md`, and the check that keeps CRM names out of Core covering that folder; each asked as its own line     | `AGENTS.md` and the strategy: a second product                                                |

- Why a is recommended: it is the smaller option, and Patric's own rule (the handbook, "Decide
  architecture") recommends the smaller option and allows no new running service without a need that
  exists now and is named. No form traffic exists yet, so b's gain, visitors and faults kept away
  from Core's program, answers a need that has not appeared, at the costs in its column. Kept in a
  folder of its own, a moves to b later at little cost, since the code is the same either way. b is
  what Patric leans to: Core's programs keep to reading and serving, for $5 a month more per
  environment and a second place to watch. c pays off if the forms become a product for sites Kowboy
  does not build: Patric asked on 2026-10-04 whether the forms are Core's work or a standalone
  widget for any site, as `docs/forms.md` records his ask, and the forms plan keeps that as a Later
  line. The separate app weighed on 2026-10-04 (question 129, option B in `docs/forms.md`, "Where
  the writes live") had its own data, which is c here.
- The same whichever is picked: the calls that send a form live in each CRM's code, which needs an
  addition to the adapter interface (protected), asked when the rebuild is planned; the answers to
  146 stand; every new part is asked first as its own line (`AGENTS.md`, "Stop and ask").
- a) **inside Core** (recommended): nothing new to run. b) **separate app**: a third program in
  Core's repository, reading Core's database. c) **separate, with its own data**.
- Smaller: a. Blocked: the rebuild of the forms. Answer a, b or c.

## 151. `[crm-vitec]` Should Vitec sites skip the "Söker du bostad?" step?

- 2026-10-05 · Patric, on 146's item 10: "Why would you want the crms password? The client site
  backend calls core with its site key, it is then authenticated to make calls using the tenant
  crm auth, why would we need another set of crm auth?" It is not another login: the site still
  calls Core with its own key, and Core uses the Vitec login it holds for the brokerage. That
  login is Kowboy's partner login ("Both CRMs hand it to Kowboy as a partner, not to a
  brokerage", `docs/forms.md`, "Terms"), and Vitec issues it a password per office (or group of
  offices) and per part of its interface ("För varje kund/grupp och funktionsgrupp som partnern
  har rättighet till så skapas också ett lösenord automatiskt"), granted "efter beställning från
  kund", once the brokerage orders it (`docs/inputs/vitec/technical-information.md`). The
  password a Vitec connection holds today opens the advertising part, which reads the homes and
  takes the interest, the viewing booking and the free valuation. The wizard's last step, the
  visitor's search profile (139, 131), is in Vitec's CRM part; the login in the environment
  answered "not authorised" (401) for that part on 2026-10-04. Mspecs needs nothing more for it.
- The step also carries the box "Kontakta mig om min nuvarande bostad" (141 a, on an interest and
  a booking), which makes the visitor a seller lead through the valuation call, in the advertising
  part. Without the step, the box moves to the contact step, so 141 a holds with no second
  password.
- Vitec's own help says Vitec builds a profile by itself from an interest only when the brokerage
  turns automatic profiles on, the interest has the status Interested or higher, and the contact
  allows matching and marketing (`docs/forms.md`, "Read online on 2026-10-04"). The interest call
  has no field for that consent, and whether the status stays in the call is open (146's list
  proposed leaving it out; Patric's answers did not settle it), so whether that happens for a site's
  interest is not known; such a profile follows the home the interest names, not the visitor's
  wishes.
- Patric approved the form designs on 2026-10-05 at 21:38 (UTC), the screens of round 9 in another
  thread: their progress bars count this step as the last one, two steps in the interest's window
  and three in the booking's, though the step's own screen was not among them. With a, a Vitec
  site's windows show one step fewer than those screens.
- a) **skip** (recommended): on a Vitec site the forms end at the interest, the booking or the
  valuation, one step fewer than the approved screens, and the box "Kontakta mig om min nuvarande
  bostad" moves to the contact step; Vitec is the only CRM with forms today, so the profile step
  is not built in the rebuild, and it comes back when a brokerage asks for it. b) **keep**, as in
  the approved screens: each brokerage first orders the CRM part from Vitec for Kowboy, then its
  connection gets that part's password, typed in the admin area; until then the step is hidden
  for that office, which needs the adapter interface change named in 146's item 10.
- Smaller: a. Blocked: nothing now; the rebuild's Vitec part. Answer a or b.

## 152. `[core]` Default: a staging or test run of the forms never sends a form to a CRM; only the live one does, with no setting

- 2026-10-05 · Patric, on 146's item 9: "Why would I want a setting to disable all forms
  centrally, I dont understand this option". It was never for turning the forms off on the live
  service. It existed because staging reads a real brokerage's live office (the Vitec login on
  staging is a client's production office): without a guard, a form tried on the staging site
  would land in that brokerage's CRM as a real lead or booking, which the rule of 2026-10-04
  forbids (`AGENTS.md`, "Stop and ask"). Core already knows which one it is, by the environment
  name it gives its alerts and error reports (staging, production or local, `engine/config.ts`),
  so no new setting is needed: the forms send only where that name is production, and everywhere
  else they stop before the CRM and answer that the form was not sent. This replaces the "Send
  forms to Vitec" switch on every Vitec connection, and 146's item 9. The first real send to
  Vitec's test customer (54 f), once that customer exists, is asked then.
- Reply only if you disagree: no.

## 147. `[crm-vitec]` Where does a Vitec connection's office list come from?

- 2026-10-05 · Patric: the list of offices a Vitec connection syncs "needs to be maintained by a
  super admin which is inconvenient"; his order of preference: from Vitec first, kept by the
  site's own admin second, typed by the super admin third, and before Vitec's list is trusted,
  each office it names is read on its own.
- What Vitec offers (every method on Vitec Connect's help site, checked 2026-10-05): every call
  names a customer id (`M30011`) or a group id (`G2`); no call lists the customers a login may
  read. The advertising office list, `GET Advertising/Office/{id}`, returns one row per office
  with that office's own customer id. With Norban's login and its own customer id it returns its
  one office, which then reads on its own; any other id answers 403, an id that is not a customer
  or group id 400. For a group: `G12` (Vitec's test account of Svenska Mäklarhuset) is an id for
  the calls, and with that tenant's login any office reads (Patric, closing 148). The list for
  `G12` itself could not be tried: the login sits on the staging tenant svenskamaklarhuset.se,
  and the one-time check by staging Core that Patric allowed (149) was refused by this session's
  permission check. That a group id lists the group's offices rests on Vitec's technical page
  ("a group of customers can be called by its group number"), the list's per-row customer id,
  and Patric's word; Core's own load proves it the first time a connection names a group id.
- What option a changes in Core: the connection's field "Offices it may see" gives way to one id
  typed next to the Connect username and password, the customer or group id Vitec issued the
  password for (part of the adapter's login, so no engine change); the connection's own office
  list is left empty, which the engine already reads as "every office the login can see"
  (`engine/ingest.ts`), so the rule of 2026-09-21 that a connection names at least one office is
  reversed; the adapter asks Vitec's office list for the id at the first load and at each daily
  comparison, reads each listed office on its own, and loads only offices that read; an office
  that leaves the list is removed with its records, as an estate that leaves the list is today.
- a) **from Vitec** (recommended): one id typed once, next to the password; the offices come and
  go with Vitec's list. b) **the site's admin keeps the list**: a page in the site's plugin where
  the brokerage adds office ids, and a new Core address the plugin calls; Core reads each id with
  Vitec's single-office call and stores it on a yes, refuses it on a no. c) **as is**: the super
  admin types the office ids.
- Smaller: a, which takes a field away and adds no page and no address. Blocked: nothing; the
  first chain customer. Answer a, b or c.

## 135. `[client-wordpress]` Default: the search tests are listed under acceptance criterion 20, the search suite

- 2026-10-04 · The acceptance list `acceptance/criteria.json` is a protected path, changed on
  Patric's word. Criterion 20, "Real clients pass the sync and search suites", already names the
  WordPress client's three list tests as its search half. The two tests of `docs/search.md`
  built on 2026-10-04 (the search by code, area and name; the links by outline) prove the same
  half and belong under the same number; the acceptance report is regenerated with them. The
  smaller option is to leave the list as it is, and the tests then run without a criterion
  naming them.
- Reply only if you disagree: no.

## 136. `[crm-mspecs]` The footer's lead form on an Mspecs site: Mspecs's lead call needs at least one matching

- 2026-10-04 · Mspecs's marketing provider API (`docs/inputs/mspecs/`) adds a lead only together
  with matching criteria (rooms, price, area, municipalities), which becomes a contact with a
  search profile; it has no plain "contact me" or valuation lead, while Vitec has. The footer's
  "Ska du sälja din bostad?" names no home and no criteria. Blocked: nothing today; no Mspecs
  site exists. Options: a) send the lead call with one matching taken from the brokerage's
  settings, such as its municipality, so the contact lands in Mspecs; b) hide the footer form on
  Mspecs sites until Mspecs offers a plain lead; c) send the footer's lead by e-mail to the
  office, outside the CRM.
- Smaller: b, until an Mspecs brokerage asks; a invents a matching in Core, which is a rule to
  write down first. Answer a, b or c.

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

## 54. Vitec on the test account: six things only a person in Vitec can set up

`[crm-vitec]` Core copies what Vitec sends, so nothing in Core waits on these; the sites'
templates do. One estate per case, set by a person in the Vitec test account, read off staging by
an agent: (a) a new-build project's homes appear in the marketed list with their `projectId`
(assumed on 2026-09-19, so a project page can list them); (b) whether the price text stays when
the price is hidden; (c) whether the area name stays when the address is hidden; (d) what status
a "till salu, visa som kommande" estate carries; (e) how each of the four bid settings shows in
`bidding`; (f) added 2026-10-04: **a demo or test customer the partner may write to**, with the
CRM function group (version 1, category CRM-Contact) granted on it, so the forms and the search
profile (`docs/forms.md`, 139) can be sent for real. The login in the environment reads a
client's production office (Patric, 2026-10-04), so no write ever goes there; it answers 200 for
the advertising group and 401 for the CRM group today. Smaller: (a) alone now, the rest when the
first client template needs them, (f) before the Vitec forms item.

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
