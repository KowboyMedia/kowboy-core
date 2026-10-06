# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 169 (124 was asked in chat only on 2026-10-03 and answered the same day; 116 to 118 were used by the handbook sessions of 2026-09-29 to 2026-10-03, 116 in chat only; 75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 168. `[core]` The Events page: what the event log is for, and what replaces the page

- 2026-10-06 · Patric: "What purpose is the event log? Greenfield it completely from scratch. It
  is not thought through, it is randomly threwn in there."
- **What the event log is.** One table in Core's database, `events`: one row for everything
  that happens, with the time, what happened, the record, the connection, the tenant, the site,
  a chain id that ties the rows of one happening together (a notification from the CRM, the
  fetch it caused, the write, the bell, the site's pull) and a few details. Core writes it in
  every process, keeps it 30 days (decision 2026-09-15; Vitec's notifications stored whole in
  it, question 63) and never reads a secret into it.
- **Who reads it today, besides the Events page.** A record's own page reads its timeline from
  it ("written: askingPrice", "a site took it"). Flow reads it: a record's state is its newest
  event. The Overview reads it twice: "Needs attention" (an office taken off, a login refused,
  a connection paused, a site that stopped pulling) and the day's figures per hour. A tenant's
  page reads, per site, how many records the site applied and failed and its last twenty
  errors. The alerts mail each attention event once as it is written. Every open admin page
  follows the log's tail to refresh itself. The acceptance tests read it to prove that a bell
  went out or a fetch was asked for.
- **What the Events page adds** over those readers: who did what on the admin area (every save,
  sign-in and action is an `admin.` event with the person on it); following one chain end to
  end for support ("why is this home not on the site?"); reading a CRM notification whole; and
  the raw list for an agent debugging Core. It was built because the rebuild sheet rated "the
  event log with filters and correlation" and "who did what on the panel" as Musts (docs/admin-panel-rebuild.md §3 F), and it shows the log as it is stored: type names, JSON, and filters
  typed as numbers. That is what makes it read as thrown in.
- **What would be lost.** Without the log: every reader above. Without the page alone: the four
  things it adds; the log and the other pages stand.
- a) **the same list as Flow, for the past** (recommended): one page, built from zero, that
  reads like Flow does after this rebuild: plain sentences, newest first, the scope picked with
  the same picker as Records (tenants, offices, entity types, one id), a "who" filter for the
  admin area's own doings, and the chain of one happening opened in place. Never a type name or
  JSON. One code path with Flow: Flow shows the newest state per record, this page shows every
  step.
- b) **history on the thing, no page**: a record's page keeps its timeline, a tenant's page
  gets its history (its connections, its sites, who saved it) and Settings lists who did what
  on the admin area. Touches the tenant page, which the forms thread is editing.
- c) **drop the page, change nothing else**: the log stays for the other readers and for agents
  through the API.
- Smaller: c. Blocked: the Events rebuild. Answer a, b or c.

## 167. `[core]` Should the engine hand its one database pool to the CRM adapters, instead of each adapter opening its own?

- 2026-10-06 · Patric: "We get intermittent errors about reserved database connections, can you
  solve it". The cause (known bug 5): staging and production share one database cluster whose
  plan lets the apps open 22 connections, and every process ran two pools, the engine's and the
  Vitec adapter's, which together could ask for far more. The fix on staging the same day keeps
  two pools a process and sizes them to fit: 2 for the engine, 1 for the adapter, 18 for six
  processes. That holds, but it splits each process's 3 connections by hand between two pools
  that never know of each other, repeats the pool's guards in two files, and gives an adapter one
  connection whatever it does. The adapter interface is protected (`AGENTS.md`, "Stop and ask"),
  and the Concept keeps adapters off the engine's storage: this would hand them a connection to
  the same database, not the engine's tables, and an adapter would still own its own tables.
- a) **yes** (recommended): the adapter interface gains one thing, the process's database pool,
  and an adapter runs its own tables through it; the Vitec adapter's own pool and its copy of the
  guards go. One pool of 3 a process, one number, in one file.
- b) **no**: the two pools a process stay as sized today.
- c) **a connection pool in front of the cluster** instead (DigitalOcean's own, no extra cost on
  the plan): the cluster then takes up to a thousand connections from the apps and holds a fixed
  few to the database, and the apps' pools could stay at any size. Needs the platform token
  (question 87, open since 2026-09-23) or a few clicks in DigitalOcean's panel, and both apps'
  database address changed to the pool's. Core runs nothing such a pool refuses (no LISTEN, no
  session settings, no named prepared statements; checked 2026-10-06).
- Smaller: b. Blocked: nothing; the errors are fixed either way. Answer a, b or c.

## 166. `[client-wordpress]` When the site cannot reach Core at all, should the plugin keep the form until Core takes it?

- 2026-10-06 · Patric, 18:12 (UTC), on 155: "we need to store the visitors data, thats the most
  importnt part to recover if the system fails. But if its legally better to store it on-site,
  then do that", and on 160: "the only purpose is to recover lost data". 160 a keeps a form from
  the moment Core has it; Core is the better place for the details (`docs/decisions.md`,
  2026-10-06). One case is left: the site cannot reach Core at all (Core down, a release that
  broke it, the network between them). The plugin then tells the window the form failed, the
  visitor reads "Det gick inte att skicka just nu" with their details still in the window, and
  nothing is kept anywhere. 150 a gave the plugin nothing for forms but its receivers.
- a) **keep it on the site** (recommended): the plugin keeps a form Core did not answer in the
  site's database, sends it again with growing waits through the plugin's own job queue (Action
  Scheduler, already there for the sync), deletes it the moment Core has it, and deletes it
  unsent after 30 days with an error in the site's log; the visitor reads that the form was
  received. Costs: a store and a schedule for forms in the plugin; the details sit in the site's
  database, and in its backups, while Core cannot be reached.
- b) **no**: the visitor tries again; nothing is kept on the site.
- Smaller: b. Blocked: nothing; built after the first version. Answer a or b.

## 165. `[core]` For 160 a: add to the adapter interface the two things a CRM's code needs to retry a form?

- 2026-10-06 · Patric answered 160 with a: "the CRM's code retries it from its own table with
  growing waits for one day, then marks it failed". A CRM's code gets a form only inside the
  site's request (`submit` in `engine/adapter-api/types.ts`); it cannot read a form Core keeps
  afterwards, nor tell Core how a retry ended. The interface is protected (`AGENTS.md`, "Stop and
  ask"), and 155's line 4 kept it as built.
- a) **yes** (recommended): two additions any CRM's code may use: read the forms Core keeps for
  one of its connections, with their details; and tell Core how one ended (delivered, refused,
  failed for good). The Vitec code and the stand-in keep each form's id and its next try in their
  own tables, not the details, which stay in Core, encrypted.
- b) **no**: the interface stays as built; no automatic retry, as 160 b: a form the CRM did not
  take is kept 30 days and listed with "Send again".
- Smaller: b. Blocked: the retry of 160 a; the rest of 160 a is built either way. Answer a or b.

## 164. `[core]` Red, yellow or nothing: which of Core's systems may raise which alert?

- 2026-10-06 · Patric, 18:06 (UTC), answering 162 with a: "there are multiple issues to be
  alerted about. Red = alert. Yellow = should be looked at. Red causes disruption in
  functionality. Yellow are handled issues but do not disrupt functionality. Maybe you have a
  better criteria. List all systems, and wether or not something can go red or yellow. Remember,
  low noise level is crucial here. Table format, let me approve each." And on 163: "If something
  needs attention, state specifically which entity where, and link to it."
- **The rules proposed.** A, red: homes on the sites are wrong or missing, or a form does not
  reach the brokerage, and Core cannot fix it alone; it is mailed and sent to Slack once when it
  starts and once when it is over, for each site, office or connection on its own, and listed on
  the Overview. B, yellow: Core held it or works around it and recovers alone, but a person should
  look within a day; it is listed on the Overview for seven days and never mailed. C, quiet: a red that is over within five minutes is
  never told, so a restart or a release never alerts; a yellow that repeats is one line per thing
  per day, with a count. These sharpen Patric's own rule with two words: "alone" (Core cannot
  recover by itself) and "a day" (how soon a yellow should be read).
- **Every system and what it may raise** (Today: what Core does before this question).

| #   | System              | What goes wrong                                                                             | Proposed                                             | Today                                        |
| --- | ------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| 1   | Database            | Core cannot reach its database                                                              | red                                                  | red                                          |
| 2   | Database version    | the database is newer than the Core running (a release taken back)                          | red                                                  | red                                          |
| 3   | Background worker   | it stopped reporting: nothing syncs, no site is rung                                        | red                                                  | red                                          |
| 4   | Loading queue       | a new connection or office has waited over 5 minutes to be loaded                           | yellow                                               | red                                          |
| 5   | Alerts              | a mail or a Slack message could not be sent                                                 | yellow                                               | not shown                                    |
| 6   | Manual sync         | a run someone started failed                                                                | nothing: that person sees it on Manual sync          | nothing                                      |
| 7   | Site pulling        | a site has not pulled for an hour                                                           | red                                                  | red                                          |
| 8   | Site taking records | a site could not take one or more records                                                   | yellow, one line per site per day                    | the record's timeline                        |
| 9   | Site bell           | a site did not answer a bell                                                                | nothing: the site pulls on its own; 7 catches a stop | nothing                                      |
| 10  | Site errors         | a site reported a programming error                                                         | nothing: Sentry has it                               | Sentry                                       |
| 11  | CRM login           | the CRM refuses the connection's login                                                      | red                                                  | listed and mailed                            |
| 12  | Stored login        | Core cannot read the login it stored for a connection                                       | red                                                  | red                                          |
| 13  | CRM answering       | the CRM failed 5 calls in a row; Core pauses and tries again                                | yellow; red when still failing after an hour         | red while paused, listed and mailed          |
| 14  | CRM notifications   | a change the CRM announced has waited over 5 minutes                                        | yellow                                               | red                                          |
| 15  | Records fetched     | a record failed 3 fetches in a row; Core keeps trying                                       | yellow, one line per connection per day              | red                                          |
| 16  | Catching up         | a connection has not caught up for 12 hours, or never did                                   | red                                                  | red, and red for minutes after every restart |
| 17  | Connection offices  | a connection has no office to sync                                                          | yellow                                               | red                                          |
| 18  | Dropped records     | Core refused a record as malformed or of an unknown kind                                    | yellow, one line per connection per day              | the record's timeline                        |
| 19  | Refused office      | the CRM refuses one office; it stays on the sites a day of grace                            | yellow                                               | red                                          |
| 20  | Office off, refused | an office left the sites because the CRM still refused it a day later                       | red                                                  | listed and mailed                            |
| 21  | Office off, chosen  | an office left the sites because it left the group "Webbplats" or the id no longer lists it | yellow                                               | listed and mailed                            |
| 22  | Form not answered   | the CRM did not answer a form (its final shape follows question 160)                        | red                                                  | red                                          |
| 23  | Form refused        | the CRM said no to a form                                                                   | yellow                                               | the record's timeline                        |

- **What a yes costs.** Rows 13, 14, 15, 17 and 19 are checks in a CRM's own code that today
  turn Core's public health answer to "failing" (500), which an uptime monitor reads as Core being
  down. For one of them to be yellow, a check needs one optional word, "yellow", in the interface
  between the engine and a CRM's code, a protected file; a yes to any of those rows is also a yes
  to that word, and a yellow check keeps the public answer at 200. Rows 20 and 21 need the CRM's
  code to say which of the two causes took an office off, one field on the event, built in the
  Vitec code by the thread that owns it. Rule C's five minutes and row 13's hour are new numbers.
  Every line follows Patric's 163 rule: it names the thing (the site, the office, the connection)
  and its tenant, and links to that thing's place in the admin area.
- Reply: "164 ok" for every row and rule as proposed, or the row number or rule letter with its
  new value ("164 ok, except 13 red, 21 nothing").

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
  bostad" moves to the contact step; Vitec is the only CRM with forms today, so the profile step is
  not built in the rebuild, and it comes back when a brokerage asks for it. b) **keep**, as in the
  approved screens: each brokerage first orders the CRM part from Vitec for Kowboy, then its
  connection gets that part's password, in the admin area inside Core or in the cloud app's tenant
  list; until then the step is hidden for that office, which needs the adapter interface change
  named in 146's item 10.
- Smaller: a. Blocked: nothing now; the rebuild's Vitec part. Answer a or b.

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
