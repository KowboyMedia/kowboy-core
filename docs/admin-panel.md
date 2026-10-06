# The admin area

**This file describes the area as it is.** A change to a page, an action, a setting, a lifecycle
event or a health check changes this file, the area's own words and the adapter's setup directions
in the same change (AGENTS.md, definition of done, Patric 2026-09-20). The test
`adapters/vitec/admin/directions.test.ts` keeps the directions honest.

The design it was built from is [`docs/admin-panel-design.md`](admin-panel-design.md): the pattern
study, the information architecture and where every Must and Should of
[`docs/admin-panel-rebuild.md`](admin-panel-rebuild.md) §3 sits. Built on 2026-09-20 on Patric's
word, "Admin area v3 build."

## Where it is and who may open it

`/admin` on the web process, served from `dist/admin` by the same app that answers the sites
(nothing is hosted elsewhere). Customers never see it; it is Kowboy's own tool (decision
2026-09-18).

Getting in is a link mailed to an address that may open the area: no password exists to share or to
phish. Two settings say who that is — `ADMIN_EMAILS`, addresses one by one, and
`ADMIN_EMAIL_DOMAINS`, whole domains (staging and production both carry `kowboy.se`, so everyone at
Kowboy is in without a list to keep; Patric, 2026-09-21). A link is good once and for fifteen
minutes (`ADMIN_LINK_MINUTES`), and the session it makes lasts a fortnight (`ADMIN_SESSION_DAYS`)
in one cookie that script cannot read.

An address that may not open the area gets exactly the answer one that may gets, and no mail: the
sign-in page never gives away who is on the list, nor that a domain is allowed at all. On a machine
with no mail sender and no environment name — a developer's own — the link comes back in the
answer, because there is no other way in; anywhere else it is only ever mailed.

**Remember this device** on the sign-in page keeps that browser signed in for thirty days
(`ADMIN_REMEMBER_DAYS`) instead of a fortnight. Every device is a session of its own, so a person
is remembered on as many as they like, and signing out of one leaves the rest alone. Settings lists
them — which browser, remembered or not, last used, signed in until — marks the one being read, and
has one button to forget every other device, for a laptop that goes missing.

## The pages

| Page            | What it is for                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**    | The verdict first: green, or which checks are red, why, and a link to where each is fixed. Then "Needs attention": the important things of the last seven days, each naming the exact office, connection or site, its tenant, and a link that opens it (`engine/attention.ts`). Then the day in figures and hourly charts, what Core holds per datatype, the sites' freshness, and any job running now. |
| **Flow**        | One list of the records in flight, newest queued first, the whole row coloured by state — waiting for the CRM, in Core, on a site, error — tailing live and animating as rows arrive.                                                                                                                                                                                                                   |
| **Records**     | The search: the scope pickers, server-side filters, sort by any column, pages of 500 (25 to 500), a column chooser, and ticked rows that recompute, fetch again or ring. Every choice is in the address, so a view is a link.                                                                                                                                                                           |
| **Tenants**     | Tenants only. One tenant is one page and one Save: name, licence, its CRM connections, its sites. A link ending `#connection:<id>` or `#site:<id>` scrolls to that block and rings it.                                                                                                                                                                                                                  |
| **Manual sync** | One scope, then a preview that writes nothing, then a job with progress, a cancel and a history. Fetch again from the CRM takes the same scope. Housekeeping is here. Called Runs until 2026-09-21.                                                                                                                                                                                                     |
| **Events**      | The whole log with its filters, a live tail, and one click to follow a chain. Panel saves, sign-ins and actions are `admin.*` events with the person on them, so "who did what" is a filter.                                                                                                                                                                                                            |
| **CRMs**        | One page per adapter, drawn from what the adapter reports: its directions, its settings, its notification URL and its sections. A second CRM appears by itself.                                                                                                                                                                                                                                         |
| **Settings**    | Configuration read-only (whether each setting is set, never its value), the migrations the database holds, the versions running, where alerts go, who may sign in, and maintenance.                                                                                                                                                                                                                     |

Every page: no reload, a toast for every outcome, one pattern for a list, a detail page, a form and
a row's actions, a confirmation before anything dangerous, an empty state that says what to do
next, and a keyboard-reachable and labelled interface. A **Go to…** button in the top bar opens the
palette and spells out the keys that also open it (⌘ K on a Mac, Ctrl K elsewhere), so nobody has
to know them (Patric, 2026-09-21: "⌘K — what is this?"). The top bar names the environment, the
version and how long this process has been running.

**The scope is picked, never typed.** One component (`admin/src/components/scope-picker.tsx`),
reading one call (`GET /scope`), gives Records and Manual sync the same four boxes in the same
order: tenant, then that tenant's CRM connections, then that connection's offices, then the kind of
record. Narrowing a wider box empties the narrower ones, so a scope can never be one tenant with
another tenant's connection under it. Nobody types a tenant number or a connection name anywhere
(Patric, 2026-09-21).

**Select all means all.** Ticking the header box ticks the rows in front of a person; when more
match than are loaded, a line above the grid offers every match instead. With it on, the actions
send the search itself — the filters the server just counted — so a hundred thousand matching
records cost exactly what fifty cost.

**Every date is Swedish**: `2026-09-21 14:05`, Stockholm time, and the figures are grouped the
Swedish way (`12 345`). Anything older than a day is also shown as "3 days ago" where a glance is
enough.

### A tenant is one page

A connection is a setting of a tenant: there is no connections page, list or menu entry (Patric,
three times). The tenant's page holds any number of connections, of the same CRM or different ones,
each with the CRM's own login fields, the offices it may see (left out for a CRM whose adapter
takes the offices from the CRM itself, question 156 a: Vitec), a **Check the login** button that
tries the CRM before anything is saved, and whatever the adapter reports about that connection.

**Offices may be left empty** (question 147 a, 2026-10-06, reversing the rule of 2026-09-21
that refused it): no office named means every office the CRM gives the login. An adapter that can
learn its offices from the CRM does so and says how in its setup steps (Vitec: the office group
"Webbplats", or every office behind the login's id); its manifest says `officesFromCrm`, the page
draws no office field for it, a save stores its list empty whatever was sent, and ingest reads the
list as empty; one that ends up with none says so in its health check. Two tenants may name the same office: the record is fetched once and written
for each of them, each with its own copies, its own version numbers and its own sites, which is
how two sites can show one brokerage's listings. Core does not warn about that; the page says it
where the offices are typed.
Its sites are on the same page with their bell address, their bell secret, their public site key
for the forms widget and the addresses the widget may be used from (empty: the bell address's
site), their setup checklist, what they reported applied and failed, and their own errors.
Under a Vitec connection, **Offices Vitec lists** says in plain words which offices reach the
sites and why, for a reader who must explain it to the brokerage: Core asks Vitec once a day, and
at each worker start, which offices sit behind the login's customer or group id, reads each one,
and uses those in the brokerage's office group "Webbplats" in Vitec, or every office when there is
no such group or it holds none of them (Patric, closing question 154). The card shows the last
check, the office groups Vitec answered, and each office with whether it reads and whether it is
synced to the sites (question 157: the line "Reaches the sites" was removed, "I dont understand the
purpose"). **Check offices now** asks at the worker's next tick, and its explanation sits beside
it. An office that came is loaded; one that went is tombstoned with all its records, so each site
deletes it at its next sync, and the tombstones stay for the retention window. An office Vitec
refuses (question 158 b) stays synced for one more day, its row saying since when, and is taken off
when the refusal still stands at the next daily check; a refusal at any fetch makes the worker
check within a minute. The card's note says all of this in plain words, for a reader who must tell the brokerage
(Patric, closing question 154), including that Vitec shows office groups only to a login with
access to its CRM part.
Under each connection, one line counts the forms visitors sent through Core to that CRM in the
last day (docs/forms.md): delivered, refused by the CRM, unanswered by the CRM; red when any went
unanswered. The visitor is never stored in Core, so the line has counts and nothing else.

One Save does all of it, and says what it did. The difference decides what the adapters are told: a
new connection is loaded, offices added or removed are loaded or tombstoned, a connection taken off
the page is removed with its records.

**A saved secret is not on the page at all.** A stored password or key never leaves Core: the field
shows `••••••••••••` where a secret exists, and that mask is the box's placeholder, not its value —
there is nothing in the page for a browser, an extension or a screenshot to read. Leaving it as it
is keeps the stored login; a field typed goes over that field alone, and every field not typed
keeps its stored value (known bug 3, fixed 2026-10-06: a save used to keep only what was typed).
A stored field cannot be emptied from the page.

Because of that, **Check the login** on a saved connection has nothing to send, so Core tries the
login it already holds, with the offices that connection is licensed for. Typed values, when there
are any, are tried instead, exactly as a save would store them — so a yes here is a yes afterwards
(Patric, 2026-09-21: the check did not work on a saved connection).

### Dangerous buttons, and the ones that only look it

Anything that removes, rotates a secret or starts a run over many records is red and asks first,
with a sentence saying what will happen: what breaks until a new token is pasted into each site,
that a site's deletion takes its history with it, that a recompute rings the sites for whatever
changed.

The rest are plain buttons that do their work at once, because nothing they do can be lost
(Patric, 2026-09-21). **Fetch again** asks the CRM for the same records and writes only what
actually differs, so running it twice does no more than running it once. **Recompute this record**
builds one record again from what Core already stores and calls no CRM. **Ring the sites** only
tells the sites to pull. Each says as much on the page next to it.

**Every button carries its sentence.** An action an adapter declares comes with `help`: what the
button does and when a person would press it, shown next to it on the page and inside the
confirmation where there is one. The acceptance test _explains every button an adapter puts on a
page_ refuses an action without it, so a new action cannot arrive unexplained and a changed action
cannot keep the old sentence (Patric, 2026-09-21).

### A record's timeline

A record's page shows its three faces — the CRM's payload, the unified record, the prepared strings
— and under them its history: when, what happened in one sentence, and a link to follow the chain
on Events. The sentence is the engine's (`engine/admin/summary.ts`), so the timeline, the Events
page and Flow cannot say different things about the same event, and adding an event type anywhere
in Core means adding its line there.

No payload is on the timeline at all — not the whole event, not the part that changed (Patric,
2026-09-21: a history of payloads cannot be read at a glance). What changed is named ("written:
askingPrice, status"); the values themselves are the three faces above, and the whole event, with
its payload, is one click away on Events.

### Maintenance

One switch on Settings. While it is on, the sites pull exactly as before — nothing a visitor sees
changes — but Core rings no site and takes no job. Changes meanwhile are remembered as pending
bells and go out in one round when it is turned off. Every page says so while it is on.

## The admin API

One JSON API under `/v1/admin/`, and the browser app is its second user: everything the app can do
an agent can do, and nothing is done in two ways. Sign-in and the sign-in link are the only calls
that need no session.

| Call                                                                                              | What it does                                                           |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `POST /sign-in`, `GET /sign-in/:token`, `POST /sign-out`, `GET /me`                               | Getting in and out, and who is in.                                     |
| `GET /overview`, `GET /health`                                                                    | The verdict, the day, the sites, the open jobs.                        |
| `GET /flow`                                                                                       | The records in flight, in the state each reached last.                 |
| `GET /stream`                                                                                     | One server-sent stream: new events, the open jobs, the health verdict. |
| `GET /tenants`, `GET /tenants/:id`, `POST /tenants`, `PATCH /tenants/:id`, `DELETE /tenants/:id`  | The tenant list, and one tenant read and written whole.                |
| `POST /tenants/:id/token`, `POST /tenants/:id/ring`                                               | A new token; ring every site of a tenant.                              |
| `POST /sites/:id/secret`, `POST /sites/:id/ring`                                                  | A new bell secret; ring one site.                                      |
| `GET /devices`, `POST /devices/forget-others`                                                     | Where this person is signed in, and forgetting every other device.     |
| `GET /scope`                                                                                      | The pickers: tenants, their connections, their offices, the datatypes. |
| `GET /records`, `GET /records/:connection/:datatype/:id`                                          | The search, and one record whole with its timeline.                    |
| `POST /records/:c/:d/:id/preview`, `POST /records/:c/:d/:id/inspect`                              | What a recompute would change; the CRM asked now, writing nothing.     |
| `POST /runs/preview`, `POST /runs/recompute`, `POST /runs/fetch-again`, `POST /runs/housekeeping` | A scope previewed, run, fetched again, and housekeeping.               |
| `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/cancel`                                             | The runs and their progress.                                           |
| `GET /events`                                                                                     | The log by any filter, paged by event number.                          |
| `GET /crms`, `GET /crms/:provider`, `POST /crms/:provider/act`, `POST /crms/:provider/probe`      | Each adapter's page as data, its actions, and a login tried.           |
| `GET /settings`, `POST /settings/maintenance`                                                     | The configuration, and the switch.                                     |

Proved by `acceptance/admin.test.ts` through HTTP and by the browser journeys in `admin/e2e`, both
named under AC 42 in the acceptance report.

## What the engine offers

The area's calls are thin: the work is the engine's own functions, which the acceptance tests also
drive directly.

- **Tenants, connections and sites** (`engine/storage/connections.ts`): make and change a tenant,
  its connections (one or several, of the same or different CRMs) and its sites; rotate a token or
  a bell secret; delete a site, which takes its history in the event log with it, or a tenant,
  which takes everything.
- **Lifecycle events** (`engine/lifecycle.ts`): `connection_added`, `connection_removed`,
  `offices_added`, `offices_removed`, `resync` and `refetch` (named records fetched again) are
  queued in `lifecycle_events` and delivered to the adapter by the worker.
- **Recompute** (`engine/recompute.ts`): any scope (everything, a CRM, a tenant, a connection, an
  office, a datatype, one record, a list, or only records an older rules version made), as a
  preview that writes nothing or for real, in pages of 200 records with progress, the records not
  sold first and the sold ones (universal `sold_at` set) last (question 74). Long runs are jobs
  (`engine/jobs.ts`) the worker takes, with progress, a result, cancel and a history.
- **Records** (`engine/storage/items.ts`): search with server-side filters, words in the unified
  record (a full-text index), sort by any column, pages and a total.
- **The event log** (`engine/events.ts`): the timeline query by record, connection, tenant, site,
  correlation id, type and time, paged by event number, newest first or oldest first. A `pull`
  event names the site that pulled, and so do a site's applied reports and its errors (the
  `X-Core-Site` header both clients send: their own bell URL). A Vitec notification is stored whole
  in its `webhook.received` event for as long as the log keeps events, 30 days (Patric,
  2026-09-20, question 63).
- **Bells** (`engine/bells.ts`): ring every site of a tenant, or one of them, for changes or for
  everything; held while maintenance is on.
- **Health** (`engine/health.ts`): the checks of the engine and of every adapter. `GET /v1/health`
  is public, for an uptime monitor: 200 when every check passes, 500 when any fails, each check
  with a detail in counts and plain words and never a customer's name (Patric, 2026-09-20,
  question 62). The names behind a count (`names` on a check) reach the alerts and the area, not
  the public answer.
- **Alerts** (`engine/alerts.ts`): when a check turns red or green again, one message by mail
  (`ALERT_EMAIL`, through Postmark: `POSTMARK_SERVER_TOKEN`, `MAIL_FROM`) and to a Slack incoming
  webhook (`ALERT_SLACK_WEBHOOK_URL`), with the detail, the names and a link to the health page
  (`PUBLIC_URL`). Told once per change, never every minute; a check first seen green is not told.
  Every change is also a `check.failed` or `check.recovered` event, with the check's name, detail
  and names. Every send is an `alert.sent` event.
- **Needs attention** (`engine/attention.ts`, questions 159 and 163, 2026-10-06): the few kinds
  of event the super admin is told about. An office taken off the sites (`office.taken_off`), a
  connection paused after failures (`connection.paused`) and a login the CRM refuses
  (`login.refused`) are logged by the adapter through the adapter API with the connection in the
  context; a site that stopped pulling is the `subscribers` check turning red (`check.failed`,
  which carries the sites by number, tenant and name in `sites`). The Overview lists them for
  seven days, newest first, one line per thing: which thing (`office Lidingö (M30011)` when the
  event carries the office's name, else its id; `connection <id>`; `site <name>`), where it is
  (its tenant, and the connection an office belongs to), the same sentence the Events page reads,
  and a link that opens the thing: the office's removed records on Records, or the connection's
  or the site's block on the tenant's page. A sites check without its sites (one written before
  they were kept) is one line with the names the check gave, linking to Tenants. Each adapter
  event is told once by mail and Slack the moment it is written, by the process that wrote it, in
  three lines ("Which:", "What happened:", "Open it:" with the whole address when `PUBLIC_URL` is
  set). A check's change goes with the checks' message above: each change's sentence, then one
  line per site that stopped pulling with its link, then the link to the health page. The event
  log is the one source: nothing is kept twice.
- **Form submissions** (`engine/http/submissions.ts`, docs/forms.md): `POST /v1/submissions` hands
  a site's form to the connection's adapter and answers what the CRM said; `GET
/v1/submissions/slots` reads a home's viewings and slots live. The outcomes table keeps the id,
  the kind, the record and the CRM's answer, never the person; the events `submission.received`,
  `.delivered`, `.refused` and `.failed` sit on the record's timeline; the check
  `submissions.failing` is red while a connection's latest submission went unanswered by the CRM.
  The browser's door (`engine/http/forms.ts`, the widget of docs/forms.md): `GET /v1/forms/config`,
  `GET /v1/forms/record`, `GET /v1/forms/slots` and `POST /v1/forms/submissions` take a site's
  public key and its origin over CORS, with the bot gate (`engine/human.ts`, `TURNSTILE_SITE_KEY`
  and `TURNSTILE_SECRET`) on a submission and a limit per address; `GET /widget/forms.js` is the
  widget itself, built into `dist/widget`.
- **Settings** (`engine/storage/settings.ts`): the switches a person throws, one row per key, read
  by whichever process needs them so web and worker agree without a restart.

## What the adapter API offers

Approved 2026-09-20 with the rebuild (questions 57 and 61) and unchanged since: `Adapter.admin`
describes the adapter's pages as data, and one more lifecycle event names records to fetch again.
The Vitec adapter implements all of it (`adapters/vitec/admin/`), and so does the fake webhook
adapter, which is how the area is proved without a CRM.

```ts
admin?: {
  /** The login form of a connection; the values become one JSON document, never shown back. */
  credentials: AdminField[];
  /** The directions at the top of the adapter's page: steps, and the settings as they are. */
  directions(): AdminDirections;
  /** The adapter's page: sections of key-values, tables with row actions, and actions. */
  panel(connections: Connection[]): Promise<AdminSection[]>;
  /** What the adapter knows about one connection, shown under its tenant. */
  connection?(connection: Connection): Promise<AdminSection[]>;
  /** Run an action a section declared; the message goes to the person who pressed it. */
  act(action: string, params: Record<string, string>, connections: Connection[]): Promise<{ message: string }>;
  /** Try the CRM with a login before it is saved, or the stored one when nothing is typed. */
  probe?(credentials: string, officeIds: string[]): Promise<{ ok: boolean; detail: string }>;
  /** Fetch one record and map it, writing nothing; null when the CRM has no such record. */
  inspect?(connection: Connection, record: AdminRecord): Promise<{ raw: unknown; mapped: MappedRecord | null } | null>;
  /** What waits on the adapter's own fetch list, for the Flow list. */
  queue?(connections: Connection[]): Promise<AdminQueued[]>;
};

/** Delivered like the other lifecycle events: the adapter puts these records on its list. */
type Refetch = { type: 'refetch'; connection: Connection; records: AdminRecord[] };
```

The engine hands the descriptions on as they are and runs the actions the adapter declared; it
never inspects what they mean, and no CRM is named in `engine/` or in `admin/src` — the seam check
enforces both.

Three event types an adapter logs through `logEvent` reach the Overview's "Needs attention" and
an alert (`engine/attention.ts`, question 159): `office.taken_off` with `office_id`, `office_name`
when the adapter knows it (the office's record is removed by then) and `reason` in plain words,
`connection.paused` with `failures` and `detail`, and `login.refused` with `detail`, each with the
connection in the context so the engine finds the tenant. Any other event an adapter logs stays in
the log.

## How it is built

- **The app**: React with Refine over the admin API, shadcn/ui components and Tailwind, one
  `DataTable` every list uses, `sonner` for the toasts and `cmdk` for the palette. All MIT, all
  approved (questions 60 and 64).
- **One build**: `npm run build` compiles the engine with `tsc` and the app with Vite into
  `dist/admin`.
- **Live**: one `EventSource` on `/v1/admin/stream` feeds Refine's `liveMode: "auto"`, so a browser
  holds one connection and every page follows along.
- **Settings it reads**: `ADMIN_EMAILS` and `ADMIN_EMAIL_DOMAINS` (who may open it),
  `ADMIN_LINK_MINUTES`, `ADMIN_SESSION_DAYS`, `ADMIN_REMEMBER_DAYS`, and the engine's own
  `PUBLIC_URL`, `MAIL_FROM` and `POSTMARK_SERVER_TOKEN` for the sign-in mail.
