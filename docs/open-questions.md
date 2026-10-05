# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 149 (124 was asked in chat only on 2026-10-03 and answered the same day; 116 to 118 were used by the handbook sessions of 2026-09-29 to 2026-10-03, 116 in chat only; 75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 146. `[core]` The forms from zero: is this the full list of what must be configurable for a site's forms?

- 2026-10-05 · Patric, answering 144: the forms build of 2026-10-04 is reverted in concept and
  only what is necessary comes back ("The starting point needs to be zero and go up"), and
  "First [of] all, list all parts that are required to be configurable on a site level." The
  list starts from nothing and adds only what a form cannot work without, or what the law asks
  for. It was read from the forms design (`docs/forms.md`), Core's code as it stands, the CRMs'
  saved documentation, the Lovable kit's README and Cloudflare's Turnstile pages (plans, updated
  2026-08-14; hostname management, updated 2026-04-27), and checked by a second agent. Words
  used: **the bell address** is the address Core calls a site at to tell it that records changed;
  **the bot check** is Cloudflare Turnstile, which tells a person from a program before a form is
  accepted, and **its setup** at Cloudflare holds a public key, a secret key and the addresses it
  works on; **a subdomain** is an address under the site's own, such as www; **an office** is
  what Vitec calls a customer, one brokerage office with its own customer id.
  - Needed on every site:

    1. **Which site a form comes from.** Core reads the address of the page the form opens on
       (the browser sends it with every call) and finds the site whose bell address has exactly
       that address; nothing is typed. This holds only while the pages are on exactly the bell
       address's address: www and no www count as different, and when a site moves to its own
       domain at launch, its bell address moves with it, since the old address can go on
       working for the records while every form on the new domain is refused. The public site
       key of 137 a is then not needed: it adds no protection, because anyone can read it from
       the page, so nothing is copied into the plugin and its line leaves the admin area. Two
       sites on one address cannot be told apart this way; that case gets its own question if
       it ever comes.
    2. **Whether the site's forms are on.** A switch in the WordPress plugin's settings, off until
       items 3 and 4 are in place, so a site still being built never shows a form a visitor can
       send. Today the site key plays this part: without it the plugin prints no form window. An
       agent can set the switch with the site's deploy, so it never waits on the admin area's
       sign-in.
    3. **The privacy page the consent line links to.** It is WordPress's own setting (Settings,
       Privacy), which the plugin hands to the form window; nothing new.
    4. **The site's address in the bot check's setup at Cloudflare.** Turnstile works only on the
       addresses listed in its setup, and a listed address covers its subdomains. Cloudflare's
       free plan allows ten addresses per setup and twenty setups.

  - Needed only in later cases, so nothing is built for them now:

    5. **A typed address for a site whose pages cannot be on its bell address**: a Lovable site,
       whose bell address is at Supabase, and a site Kowboy does not build. A field on the site in
       the admin area, empty by default. No such site has forms today.
    6. **The office that receives a free valuation**, for a brokerage with more than one office,
       since the valuation is the one form with no home to name its office. Whether the site
       names the office or the visitor picks one is asked when such a brokerage gets the forms.
    7. **Which bot-check setup the site uses**, from the eleventh site on Cloudflare's free plan,
       since one setup covers ten addresses and each setup has its own keys. Cloudflare's
       Enterprise plan offers one setup for any address instead.

  - Needed beyond the site, for the forms to work at all:

    8. **The bot check's two keys**, the public key and the secret key of one setup: two
       environment settings of Core, so the admin area shows nothing.
    9. **Whether Core may send forms at all**: one environment setting of Core, off on staging and
       on local runs, on for the live Core, so no test form reaches a brokerage's real CRM. It
       replaces the "Send forms to Vitec" switch on every Vitec connection.
    10. **Vitec's password for its CRM part**, a field on a Vitec connection: Vitec grants its
        interface in parts, each with its own password per office or group of offices, and the
        search profile of the last step ("Söker du bostad?") is in the CRM part. Without it, the
        last step does not show for that office's forms. Needed only where the last step is
        wanted.

  - Needed per brokerage, but not a setting: the agreement that makes Kowboy the brokerage's
    processor of personal data names the forms, which the law asks for before a brokerage's
    forms go live. Not settings in Core: the form window's look (the theme's colours and font)
    and which forms a page shows (the theme's buttons).
  - Not needed, so left out unless Patric names one: the "Send forms to Vitec" switch, the six
    Vitec choices, the site key and its line, and the form counts. In place of the six choices, a
    booking always asks Vitec for the e-mail confirmation the form window promises ("Du får en
    bekräftelse från mäklaren"), with no SMS and no reminder; the lead source, the intake source
    and an interest's status are left out, so Vitec chooses (its documentation says an interest
    then gets its preselected lead source, and says nothing for the booking and the valuation).
  - Blocked: the rebuild of the forms. Nothing is removed from staging until the list stands;
    then the forms build leaves Core, and only what the list names comes back, every other part
    asked first (`AGENTS.md`, "Stop and ask").

- a) **yes**: the list is right, and the rebuild brings up these settings and no other setting.
  b) **no**: name the numbers to strike, or what to add.
- Smaller: a.

## 147. `[crm-vitec]` The offices of a Vitec connection: typed by a super admin, listed by the client, or read from Vitec?

- 2026-10-05 · Patric: the list of offices a Vitec connection syncs "needs to be maintained by a
  super admin which is inconvenient"; two ideas, an API method that lists every office (checked
  office by office before it is trusted) or a list the client's admin keeps, each added id checked
  against Vitec's single-office method; "which is your best idea? Discuss first."
- What Vitec offers, checked on 2026-10-05 against every method on Vitec Connect's help site (the
  advertising, public advertising, CRM, lead, authentication, business-intelligence, report,
  message, service, AML, economy and my-pages sections): every method takes a customer id
  (`M30011` and the like, or a group `G2`); none lists the customers a login may read. Vitec's
  technical page says that overview is on its partner portal, a website for people, and that
  Vitec grants rights per customer after the customer orders. A Vitec password is issued per
  customer (or group) and function group, so one key pair reads exactly one customer or one
  group. Verified with the login in the environment: its own customer id answers 200, four other
  ids (two from Vitec's examples, a group id, a tenant id) answer 403 "Access violation on
  resources", and an id that is not a customer id answers 400. The office list for the login's
  customer id (`GET Advertising/Office/{customerId}`) returns exactly its one office, and the
  single-office method answers 200 for that office: the list names nothing the login cannot read.
  Not verifiable here: whether a group id lists every office of a chain, each with its own
  customer id, and whether Vitec issues the advertising password for a group at all; that needs
  Vitec's word or a group key pair (question 148).
- What this means for the two ideas. Idea one, a method that lists every office: it does not
  exist for a login; it exists for one customer or group id, and for a single-office customer it
  returns the id typed. Idea two, the client's admin keeps the list and Core checks each id: the
  check already exists ("Check the login" on the tenant's page calls the office list per id, 200
  is yes and 403 is no), but a key pair reads one customer, so every id but the one Vitec issued
  the password for is refused; the client could only ever add the id the super admin already
  holds, because the password and its customer id sit side by side on Kowboy's partner portal,
  which the client never sees. It adds a Core endpoint and a plugin page without removing a step.
  Today, a single-office brokerage means one id typed once at setup and never touched again; the
  only list that changes over time is a chain's.
- a) **one id, the rest from Vitec** (recommended): a connection holds the key pair and the one
  customer or group id Vitec issued it for; Core asks Vitec for the office list behind that id at
  setup and at every daily comparison, and syncs what it returns, so a chain's offices come and go
  by themselves. The super admin types one id once, at the same moment as the password, and keeps
  no list; nothing changes on screen for Norban beyond the field holding one id. Supersedes the
  decisions of 2026-09-16 (the offices as the fetch scope) and 2026-09-21 (a connection names at
  least one office) with "a connection names its one id". The chain case is built only after 148
  is answered. b) **the client keeps the list**: a new page in the site's plugin and a new Core
  endpoint that checks each id against Vitec and stores it; same step for the super admin as
  today, one page and one endpoint more. c) **as is**: the super admin types the ids; one id, once,
  for a single-office brokerage.
- Smaller: a, which removes a list and adds nothing a person sees. Blocked: nothing today; the
  chain case, when the first chain arrives. Answer a, b or c.

## 148. `[crm-vitec]` Ask Vitec whether one login can cover a chain's offices through a group id

- 2026-10-05 · Option 147 a is verified for a single-office customer and unverified for a chain:
  Vitec's technical page says a group of customers can be called by its group number (`G2`), the
  office list accepts a group id as an id (a 403 for a group the login lacks, not a 400), and the
  business-intelligence methods document "group or customer id", but the advertising office list
  documents only "customer id" and the login in the environment belongs to a customer without a
  group. A question to Vitec (connect@vitec.se) settles it: "does the advertising function group
  issue a password for a group, and does `GET Advertising/Office/{groupId}` then list every office
  of the group with its own customer id?" A message outside the project is sent only on Patric's
  word. Blocked: the chain case of 147 a.
- Smaller: no, and the chain case waits for the first chain. Answer yes (I draft the e-mail for
  Patric to send) or no.

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
