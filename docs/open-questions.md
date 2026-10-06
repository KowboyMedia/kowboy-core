# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 186 (124 was asked in chat only on 2026-10-03 and answered the same day; 116 to 118 were used by the handbook sessions of 2026-09-29 to 2026-10-03, 116 in chat only; 75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 185. `[core]` May the CRM's code get four things from Core it lacks, so the Vitec page names, links and addresses things as the rest of the admin area does?

- 2026-10-06 · The Vitec page, its checks and its messages now read for a cold reader, except
  where they need something only Core knows: the adapter API (protected) does not hand it to the
  CRM's code. Until then the Vitec page writes "The Vitec connection with the short name
  acme-crm", names a record by Vitec's id for it, links nothing, and shows the notification
  addresses as "Core's own address, followed by /v1/hook/…". Question 184 covers the checks'
  titles and links; this covers the rest.

| Item | What                                                                                                           | Why                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1    | Each connection Core hands the CRM's code carries its tenant's name (`tenantName` on `Connection`).            | The Vitec page and its checks say "Acme's Vitec connection, short name acme-crm".                       |
| 2    | One more kind of value on a CRM's page: a text with a place in the admin area, which the page draws as a link. | Each connection, office or record the Vitec page names opens its place, as everywhere else in the area. |
| 3    | The CRM's code may ask Core for the address of a record, by the CRM's id for it.                               | A record on the Vitec page reads "Storgatan 12", not Vitec's id for it.                                 |
| 4    | The CRM's code may read Core's public address, the server setting `PUBLIC_URL` Core already has.               | The Vitec page shows the notification addresses to give Vitec in full, ready to copy.                   |

- Smaller: items 1 and 4 alone; a record then stays named by the CRM's id, and nothing on the
  Vitec page is a link. Blocked: those names, links and addresses on the Vitec page and in its
  checks. Reply: "185 ok", or the items you do not want.

## 184. `[core]` May a CRM's checks carry a title and links, so the Overview never shows a check's name?

- 2026-10-06 · Building 172 to AGENTS.md's definition of done item 5. The engine's own checks
  now show a title and a sentence, and the sites check links each site it finds behind. A CRM's
  checks all show one title, "Fetching from Vitec", and name their connections and offices as
  plain text, because the adapter API has no word for either; the Vitec code is writing their
  sentences now.

| Item | What                                                                                                                                       | Why                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1    | One optional word `title` on a check's result in the adapter API, kept with the result in `health_results` (a column) for the web process. | The Overview's tile and the alert read a title such as "Vitec's notifications", never `vitec.webhook_lag`. |
| 2    | One optional word `links` on a failing check's result: each thing it names with its place in the admin area, kept the same way (a column). | Each connection or office a CRM's check names opens its page, as the sites check's sites already do.       |

- Smaller: item 1 alone; the connections and offices then stay plain text under the check.
  Blocked: the CRM's checks' titles and links on the Overview and in the alerts. Reply: "184 ok",
  or the items you do not want.

## 183. `[admin]` Records and Manual sync: the parts Patric did not name, keep or drop each

- 2026-10-06 · Patric, 21:30 UTC, of Manual sync's "Clear the scope": "was never specified. This
  tells me you did not greenfield it as required." That button and Records' "Show everything"
  came from the old pages and are gone. These are the other parts of the two pages that his
  words of 18:51 UTC (Task 1) did not name.

| Item | Page        | Part                                                                                                               | Recommended                                                                                 |
| ---- | ----------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1    | Records     | "Live", "Removed" or "Both": live records are on the sites; removed ones left the CRM's list and are kept 90 days. | Keep: the alert about an office taken off the sites opens that office's removed homes here. |
| 2    | Records     | Sorting by a click on a column's title.                                                                            | Keep.                                                                                       |
| 3    | Records     | Pages of 500 records (25 to 500 to pick), with Back and Next.                                                      | Keep: Core holds thousands of records.                                                      |
| 4    | Records     | The "Columns" button, which adds the columns "Changed in the CRM" and "CRM connection".                            | Drop the button and both columns; a record's own page shows both.                           |
| 5    | Records     | A click anywhere on a row opens the record, as its name does.                                                      | Keep.                                                                                       |
| 6    | Manual sync | Under the scope, one line: "This covers the homes of the tenant Acme: 637 live records now."                       | Keep: it says how much a run touches before it starts.                                      |
| 7    | Manual sync | "Start" first says in a window what will happen, and runs on "Start it".                                           | Keep: the full level asks the CRM for every record in the scope.                            |
| 8    | Manual sync | One sentence under each of the three levels, saying what it does.                                                  | Keep.                                                                                       |
| 9    | Database    | The column that held a request to stop a run, which only the old Manual sync made.                                 | Drop it, with a one-time step at the release.                                               |

- Reply "183 ok" for every recommendation, or name the items to change. Smaller: dropping more.
  Blocked: nothing; both pages work as they are.

## 182. `[admin]` The new record page: is this design right, so the old page goes once it is built?

- 2026-10-06 · Patric, 21:37 UTC: "the single entity viewer is shit, create a new replacement.
  Purpose: Troubleshoot its trace, view its data, retry things. Figure out what is best. Do not
  anchor in the old". It is built from zero beside the old page and takes its address, so every
  link (Flow, Records, Failed forms, the alerts) opens the new one; the old one stays reachable
  at `/admin/records-old/…` until this is answered.

| Item | Part                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | For                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1    | The top: the record's name, then one sentence saying what it is, whose it is (tenant, office and CRM connection, each a link) and the CRM's id for it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Knowing what one looks at.                        |
| 2    | "Where it is now", three steps in order, each with the buttons that act on it. **In the CRM**: when the CRM last changed it; "Compare with the CRM now" asks the CRM, writes nothing and lists the fields that differ from Core's copy; "Fetch again" asks the CRM again, recomputes and sends to the sites. **In Core**: when Core last wrote it, whether it is removed, and whether today's rules made its texts; "Recompute" works its texts out again and sends to the sites. **On the sites**: one line per site of the tenant, from the sites' own reports of the last 30 days: holds Core's copy, holds an earlier one, or could not take it and why; "Send again" sends it to every site again. | Troubleshooting and retrying.                     |
| 3    | "What happened": the record's history in chains, newest first. A chain is one change, from the CRM's message to each site, each step a sentence with its time; a change Core tied together links to all its steps in the event log, including those about other records.                                                                                                                                                                                                                                                                                                                                                                                                                                | The trace.                                        |
| 4    | "Its data": three tabs, the texts ready to show, the unified record and what the CRM sent, each with "Copy" and its sentence beside it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Viewing its data.                                 |
| 5    | Not carried over from the old page: "Preview a recompute" (step 2 says whether today's rules made it), "Ask the CRM now" (the comparison replaces it), "Tell the sites" ("Send again" replaces it) and the list of dates and versions (in the steps now).                                                                                                                                                                                                                                                                                                                                                                                                                                               | Nothing left that the three purposes do not need. |
| 6    | Behind it: Core's answer for a record gains each site's last report on it, the rules running today and how long the event log and removed records are kept; each step of its history gains its site and its place in the order of changes; the comparison gains the fields that differ. Manual sync's call takes named records (up to 500; the record's page sends one), so the three retry buttons are Manual sync's three levels for this record, the same code. A field that comes or goes, even to or from nothing, now counts as changed in the history, as it already did for the sites. No new address, table or event.                                                                          | Items 2 and 3.                                    |

- a) **yes** (recommended): as above; the old page goes, with what only it used, once the new
  one is built and shown.
- b) **change**: name the items.
- Smaller: a. Blocked: deleting the old record page. Answer a or b.

## 181. `[core]` `[crm-vitec]` Should a QA connection's forms go to Vitec's QA from the staging service?

- 2026-10-06 · Patric, 21:29 UTC, of the new tenant page's QA switch: it "changes base path,
  allows form submissions even in staging, explain this". Today the staging service sends no
  form to any CRM, QA included (his words at 19:29 UTC: staging sites dry-run forms only), and the
  central forms guard cannot tell a test system from a live one, because only the Vitec code
  knows which login is QA (his rule at 21:10 UTC).
- a) **yes** (recommended, his newest words): the CRM code's interface gains one optional
  answer, "is this connection a test system?", which the Vitec code answers yes for a QA login;
  the forms guard then lets that connection's forms through outside production, and holds every
  other form as now. The interface is a protected part, so this answer also approves that piece.
- b) **no**: staging keeps holding every form, QA included, and the switch's sentence says so.
- Smaller: b, which builds nothing. Blocked: a form reaching Vitec's QA from staging. Answer a
  or b.

## 180. `[admin]` The new tenant page: six things beyond Patric's list, or that need his word

- 2026-10-06 · Patric, 21:29 UTC, listed the new tenant page: the name, enabled or disabled, the
  token with a way to make a new one; the CRM connections, each with its name and CRM, and for
  Vitec the username, the password, the customer or group id, the QA switch, "Check login",
  "Fetch offices" and the offices list, with the Flow list of the tenant under them; the sites,
  each with its address, bell path and bell secret with a way to make a new one. It is built
  from that list, from zero, beside the old page. These six need his word.

| Item | What                                                                                                                                                                                                                                                                                                                                                                 | Why                                                                                                                                                                                                                                                                                                               | Recommended |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1    | A connection's name: **a)** a name of its own that can be changed (a new column `name`), while the short name stays the fixed key that Core files the records, events and links under, made by Core from the first name typed; **b)** the short name itself becomes changeable, and Core renames it in every record, event and link and in the CRM code's own lists. | His words: "Short name: make it editable". b also changes the CRM code's interface (a protected part) and rewrites stored history.                                                                                                                                                                                | a           |
| 2    | Withdrawn on 2026-10-06, nothing to answer: the page draws a login field whose only choices are no and yes as a tickbox, so "Use Vitec's QA environment" is a tickbox without any change to the CRM code's interface.                                                                                                                                                | His words: "a toggle/checkbox".                                                                                                                                                                                                                                                                                   | none        |
| 3    | The hint under "Customer or group id": "The id Vitec issued this login for. A group id, such as G12, loads every office in the group; a customer id, such as M30011, loads that one office."                                                                                                                                                                         | His words: "hint that any customer ID will work, if they have multiple". Core asks Vitec for exactly the id typed, and a login reads only the id it was issued for (Vitec refused any other on 2026-10-05), so a customer id loads only its own office. Inferred, not tested with a brokerage of several offices. | yes         |
| 4    | Under each site, one line: when it last fetched changes, and what it answered when last told of changes.                                                                                                                                                                                                                                                             | The alert "a site stopped fetching" opens the site here; without the line the page says nothing about it.                                                                                                                                                                                                         | yes         |
| 5    | "Remove this tenant" at the bottom of the page, with its sentence beside it.                                                                                                                                                                                                                                                                                         | Not in the list; without it no tenant can be removed.                                                                                                                                                                                                                                                             | yes         |
| 6    | Once the old page is gone, the two switches only it had leave Core: a site's on/off switch, and a connection's pause switch, which the CRM code also reads through its interface (a protected part). A one-time step at the release drops both; every site and connection is then on.                                                                                | The clean-up rule: what nothing uses goes. A step that changes production's stored data needs his word.                                                                                                                                                                                                           | yes         |

- Reply "180 ok" for every recommendation, or name the items to change. Smaller: item 1 a.
  Blocked: renaming a saved connection (1; a new one still takes a name); items 3 to 6 block
  nothing in the build. Item 2 was withdrawn the same evening.

## 178. `[core]` May Core keep each failing check's level, and show it on "Needs attention"?

- 2026-10-06 · Building 172 (the levels): three things the build needs that 172 did not list.

| Item | What                                                                                                                  | Why                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1    | A column `level` in `health_results`, the table where the worker leaves the CRM's checks for the web process to read. | The Overview colours a CRM check by the level the CRM's code gave it; without it, a CRM check shows red whatever its level. |
| 2    | A field `level` on each `check.failed` event, written again when a problem moves up a level (P2 to P1).               | "Needs attention", the 07:00 mail and the event log know each problem's level after it is over.                             |
| 3    | Each line of "Needs attention" shows its level (P0, P1 or P2) beside its time.                                        | A reader sees at once which lines were alerts and which are only to look at.                                                |

- Smaller: items 2 and 3 alone; the CRM's checks would then show red on the Overview whatever
  their level until item 1. Blocked: the Overview's colours for the CRM's checks (1), and the
  list and the 07:00 mail for problems that are over (2). Reply: "178 ok", or the items you do
  not want.

## 177. `[crm-vitec]` Should the Vitec page's connections, the tenant's card "Offices Vitec lists" and "Check the login" also mark a QA office "(QA)"?

- 2026-10-06 · Asked by the "New CRM vitec-qa" thread after a review of the QA build. Question
  169 a approved the mark "(QA)" on the Vitec page's fetch list and refused offices only. The
  build had put it in three more places; they are taken out again until this is answered.
- **Why it matters.** A login is never shown back on its page, so once it is saved, nothing on
  the pages tells a QA connection from a live one. With the mark, the Vitec page's list of
  connections shows "M1 (QA)" in the QA connection's row, the tenant's card "Offices Vitec
  lists" shows "M1 (QA)" as the id typed, and "Check the login" answers "M1 (QA): Vitec
  answers …", so the person checking a QA login sees that QA answered. Without it, all three
  show "M1" for both systems, and the connection's own name and its tenant are the only hints.
- a) **yes** (recommended): the three places mark a QA office "(QA)" too.
- b) **no**: only the fetch list, the refused offices and the names in `vitec.offices` mark it,
  as now.
- Smaller: b, which builds nothing. Blocked: nothing; the QA switch works either way. Answer a
  or b.

## 171. `[core]` Adding a site's address to the bot check at Cloudflare: may Core keep Kowboy's Cloudflare account id as a second environment setting?

- 2026-10-06 · 155's line 6, approved: each site's address goes on Cloudflare's list when the
  site is saved in Core's admin, with a Cloudflare key kept as an environment setting. Every
  address of Cloudflare's interface for that list names the account
  (`/accounts/{account id}/challenges/widgets/{site key}`; Turnstile's widget management page,
  updated 2026-05-05), so Core needs the account's id as well as the key. Cloudflare's
  documentation does not say whether a key that may only change Turnstile can look up its own
  account. Free plan: ten addresses per pair of keys, and an address covers its subdomains
  (Turnstile's hostname management page, updated 2026-04-27).
- a) **yes** (recommended): two settings where the forms are received, `CLOUDFLARE_ACCOUNT_ID` and
  `CLOUDFLARE_API_TOKEN` (a key with the permission "Turnstile Sites Write"), set once with the
  Cloudflare account. A save of a site adds its address to the list, and the save's answer says
  whether Cloudflare took it; without the two settings (staging, local) nothing is asked.
- b) **look it up**: only the key; Core asks Cloudflare for the key's account at each save. If
  Cloudflare does not answer that to such a key, no address is added and the save says so.
- Smaller: a. Blocked: adding a site's address automatically, which a live site needs before its
  window can earn the bot check's proof. Answer a or b.

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
- **A gap found on the way.** The chain id ties a CRM's notification, the fetch it caused and
  the write together, and stops there: the bell, the site's pull and its applied report carry
  none. The page's own words, "follow a chain to see one notification all the way to a site",
  promise more than the log holds; today a record's own timeline is what shows a site taking it.
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
- 2026-10-06 19:11 · Patric: "I understand the purpose of a complete system event log now, such
  as received webhooks, sent bells, sent alerts etc. I dont understand your option "a" can you
  illustrate it". Option a was drawn for him in the thread the same evening.
- Smaller: c. Blocked: the Events rebuild. Answer a, b or c.

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
