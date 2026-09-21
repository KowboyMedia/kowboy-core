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

Getting in is a link mailed to an address on `ADMIN_EMAILS`: no password exists to share or to
phish. A link is good once and for fifteen minutes (`ADMIN_LINK_MINUTES`), and the session it makes
lasts a fortnight (`ADMIN_SESSION_DAYS`) in one cookie that script cannot read. An address that may
not open the area gets exactly the answer one that may gets, and no mail. On a machine with no mail
sender and no environment name — a developer's own — the link comes back in the answer, because
there is no other way in; anywhere else it is only ever mailed.

## The pages

| Page         | What it is for                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Overview** | The verdict first: green, or which checks are red, why, and a link to where each is fixed. Then the day in figures and hourly charts, what Core holds per datatype, the sites' freshness, and any job running now. |
| **Flow**     | One list of the records in flight, newest queued first, the whole row coloured by state — waiting for the CRM, in Core, on a site, error — tailing live and animating as rows arrive.                              |
| **Records**  | The search: server-side filters, sort by any column, pages of 25 to 500, a column chooser, and ticked rows that recompute, fetch again or ring. Every choice is in the address, so a view is a link.               |
| **Tenants**  | Tenants only. One tenant is one page and one Save: name, licence, its CRM connections, its sites.                                                                                                                  |
| **Runs**     | One scope, then a preview that writes nothing, then a job with progress, a cancel and a history. Fetch again from the CRM takes the same scope. Housekeeping is here.                                              |
| **Events**   | The whole log with its filters, a live tail, and one click to follow a chain. Panel saves, sign-ins and actions are `admin.*` events with the person on them, so "who did what" is a filter.                       |
| **CRMs**     | One page per adapter, drawn from what the adapter reports: its directions, its settings, its notification URL and its sections. A second CRM appears by itself.                                                    |
| **Settings** | Configuration read-only (whether each setting is set, never its value), the migrations the database holds, the versions running, where alerts go, who may sign in, and maintenance.                                |

Every page: no reload, a toast for every outcome, one pattern for a list, a detail page, a form and
a row's actions, a confirmation before anything dangerous, an empty state that says what to do
next, a keyboard-reachable and labelled interface, and ⌘K to go anywhere. The top bar names the
environment, the version and how long this process has been running.

### A tenant is one page

A connection is a setting of a tenant: there is no connections page, list or menu entry (Patric,
three times). The tenant's page holds any number of connections, of the same CRM or different ones,
each with the CRM's own login fields, the offices it may see, a **Check the login** button that
tries the CRM before anything is saved, and whatever the adapter reports about that connection.
Its sites are on the same page with their bell address, their bell secret, their setup checklist,
what they reported applied and failed, and their own errors.

One Save does all of it, and says what it did. The difference decides what the adapters are told: a
new connection is loaded, offices added or removed are loaded or tombstoned, a connection taken off
the page is removed with its records.

### Dangerous buttons

Anything that removes, rotates a secret or starts a run over many records is red and asks first,
with a sentence saying what will happen: what breaks until a new token is pasted into each site,
that a site's deletion takes its history with it, that a fetch again makes real calls to the CRM.

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
  Every send is an `alert.sent` event.
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
  /** Try the CRM with a login before it is saved. */
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

## How it is built

- **The app**: React with Refine over the admin API, shadcn/ui components and Tailwind, one
  `DataTable` every list uses, `sonner` for the toasts and `cmdk` for the palette. All MIT, all
  approved (questions 60 and 64).
- **One build**: `npm run build` compiles the engine with `tsc` and the app with Vite into
  `dist/admin`.
- **Live**: one `EventSource` on `/v1/admin/stream` feeds Refine's `liveMode: "auto"`, so a browser
  holds one connection and every page follows along.
- **Settings it reads**: `ADMIN_EMAILS` (who may open it), `ADMIN_LINK_MINUTES`,
  `ADMIN_SESSION_DAYS`, and the engine's own `PUBLIC_URL`, `MAIL_FROM` and `POSTMARK_SERVER_TOKEN`
  for the sign-in mail.
