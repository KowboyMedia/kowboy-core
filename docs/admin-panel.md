# Admin panel

Approved 2026-09-18 (question 29), rebuilt from scratch on 2026-09-20 at Patric's word (every
Must and Should of `docs/admin-panel-rebuild.md`, nothing carried over from the first build):
`admin/` (the browser app), `engine/admin-api/` (its API) and `adapters/vitec/admin/` (what the
Vitec adapter shows), tested as AC 42. One place, in a browser, to configure Core and its adapters
and to see what is happening, so that nothing needs a database client, a script or a console.

**This file describes the panel as it is.** A change to a page, an action, a setting, a lifecycle
event or a health check changes this file, the panel's own words and the adapter's setup
directions in the same change (AGENTS.md, definition of done, Patric 2026-09-20). Two tests keep
the directions honest: `adapters/vitec/admin/directions.test.ts` (every setting, lifecycle event,
health check and credential field is named) and the browser journey that opens every adapter's
page from what it describes.

## Shape

- **Two halves, one code path.** The engine's web process serves a JSON API under `/v1/admin/`
  (`engine/admin-api/`): the single place where tenants are saved, records searched, recomputes
  run and events read. The browser app (`admin/`, React on Vite, built into static files by
  `npm run build` and served by the same web process under `/admin`) is that API's user, and so
  are the agents with the admin secret: the API takes a login session or the `X-Admin-Secret`
  header for the same doors. Nothing is done in two ways.
- **Login.** By email link (no shared password, Patric 2026-09-18): the login page takes an
  address, and when its domain is on the allowed list (`ADMIN_EMAIL_DOMAINS`) a link goes there
  by mail; the page answers the same way whatever the address, so the list stays private. The
  link lasts 15 minutes and opens a session for 12 hours, or for 30 days with "Remember this
  device". The mail goes through Postmark (`POSTMARK_SERVER_TOKEN`, `MAIL_FROM`), at most one link
  per address per minute and ten a day in all. While a mailbox is in maintenance,
  `ADMIN_LOGIN_WITHOUT_EMAIL=true` lets an allowed address in straight from the form (Patric,
  2026-09-19); every attempt is logged as `admin.login`. A change through the API needs the app's
  own header beside the session cookie, which a page on another site cannot send: that is the
  defence against cross-site requests. Users and roles come later.
- **Who did what.** Every change made through the panel or the API is one `admin.action` event
  with the person's address (or "agent" for the secret), the action and its fields. The Events
  page shows them as the audit trail.
- **Live.** One server-sent event stream per open page (`/v1/admin/stream`): new events and job
  progress reach the page within a second, and the lists, figures and jobs on it refresh
  themselves. The header shows whether the feed is live. Without it the pages still refresh
  themselves every few seconds.
- **How it is built.** A single design: one pattern each for a page, a card, a list, a form and a
  row's actions, drawn with shadcn/ui components on Tailwind, every page a title, one line on
  what it is for, and cards that say what they show or do. Every outcome is a toast; a removal, a
  new secret or a big run asks first and says what will happen; every empty state says what to do
  next. Charts by Recharts in colours validated for colour vision and contrast (blue, orange,
  teal, purple as series; red only for what failed), with a legend, hover readouts and a table
  twin. Every time is Swedish time with the UTC moment on hover. Core serves every script and
  style itself; the page allows nothing from another host.
- **Adapters describe, the app draws.** An adapter ships no page: it hands the engine data that
  describes its panel (sections of key-values, tables with row actions, actions with fields and
  confirmations), its setup directions and settings, what it knows about a connection, a probe of
  a typed login, one record fetched and mapped without writing, and what waits on its own fetch
  list. The app draws all of it with the same components as its own pages and never names a CRM
  (the seam check scans `admin/src` too).
- **Tests are the acceptance.** The API is driven through HTTP in the acceptance harness
  (`acceptance/admin-app.test.ts`), the web process as deployed in
  `acceptance/entrypoint.test.ts`, and every user journey in a real browser against a Core
  started as the tests start it, with the fake CRM behind it (`admin/e2e/`, run by
  `npm run test:e2e`, an enforced check). AC 42 names all of them.

## Pages

1. **Dashboard** (`/admin`, the first page after login). Six figures: health (checks passing),
   live records (and removed ones), written in the last 24 hours with a sparkline per hour, sites
   up to date (pulled within the hour), bells in the last 24 hours (and unanswered ones), and
   what waits for the worker (lifecycle events and jobs). Two charts per hour over the last 24
   hours: records (written, removed in the CRM, dropped) and sites (bells, pulls, applied,
   failed). Then records per datatype, the sites' freshness meter with the pulls' answer times,
   and everything else in the event log by type. Below: the health checks as `/v1/health` reports
   them, records per tenant, jobs running, the last 20 events, and the versions of the rules, the
   schema and the migrations.
2. **Tenants.** The list (number, name, licence, CRM, offices, sites, live records, last write
   from the CRM, last error), searchable, and "New tenant". One page makes a tenant and changes
   it, the same page, components and code path (Patric, 2026-09-20): the name and licence; the
   CRM connection, chosen from the CRMs Core ships, whose login the adapter declares (stored
   encrypted, never shown again; leave it empty to keep it) with "Check the login" that tries it
   at the CRM before anything is saved, and the offices; and the sites, one or many, each with
   its name, bell URL and active flag. One Save does it all, in place, with a toast that says what
   happened and errors at the fields: the tenant is made and gets its number and token, the
   connection is made (id `<crm>-<tenant number>`) and loaded from the CRM once the login is
   there (`connection_added`), an added office is loaded and a dropped one taken off the sites
   (`offices_added`, `offices_removed`), a new site gets its bell secret and a removed one is
   deleted. Below the form on an existing tenant: the token with a copy button ("New token"
   retires it after a confirmation); the setup checklist (login and offices saved, records
   loaded, a bell answered, a pull with the token, a record applied); the connection's state,
   the latest load's progress (written, unchanged, removed, dropped since it started) and its
   actions (load everything, resync a datatype or all, preview a recompute, remove everything);
   what the adapter knows about the connection with its run-now actions; "Look at a record" (raw,
   unified and display from the CRM, nothing written) and "Fetch again" for one record; the sites
   with their secrets, last bell and answer, whether the bell was answered, the last pull, and a
   menu per site (ring for changes or everything, new bell secret); records here and on the sites
   (per datatype what Core holds, what the sites reported applied, and what failed there, named);
   the sites' own errors (`POST /v1/errors`); "Try it as a site" (pull as a site with the sizes,
   ring); and the latest events. "Fetch everything again" at the top resyncs the connection.
3. **Records.** Six figures: live and removed records, written, removed and dropped in the last 24
   hours, applied and failed at the sites. A search with server-side filters (tenant, CRM,
   datatype, office, record id, words in the unified record, the days it was written, removed or
   not), sort by any column, pages of 25 to 500, a column chooser, and a selection with "Preview
   recompute" and "Fetch again". The live activity list: the last 100 records through the write
   path and what waits on the adapters' own fetch lists, newest first, the whole row coloured by
   state (waiting on the CRM, fetched and written, applied by a site, failed) with what happened,
   the attempt, what the site reported and the chain's correlation id; new rows light up. One
   record's page: where it stands (seq, office, written, changed in the CRM, removed, rules and
   schema version, hash); raw, unified and display side by side as collapsible JSON viewers with a
   copy; its timeline down to what each site applied; preview a recompute, fetch it again, ring
   the sites. Never a hand edit of data.
4. **Jobs.** Long operations run by the worker with progress, a result and a history. A recompute
   of any scope (everything, a CRM, a tenant, a connection, an office, a datatype, or only records
   an older rules version made) always previews first: the preview examines every record and
   writes nothing, and its page shows examined, changed, unchanged and failed, the failing records
   with their errors, and examples with each field before and after; "Run for real" queues the
   same scope for real, with new seqs and the sites rung. A running job can be stopped after its
   current batch; what was done stays done. The list is the history.
5. **Events.** The timeline query of strategy §8.2, newest first: filter by tenant, connection,
   type, correlation id, one record and a time range; page back with "Older"; the newest page
   refreshes itself; a value that is not a date or a number is left out and said so; follow a
   chain from a webhook to the writes, bells and pulls it caused by its correlation id; "Audit
   trail" shows who did what on the panel.
6. **Adapter pages.** One per CRM, under the CRM adapters heading, drawn from what the adapter
   describes. Every adapter page opens with its setup directions (the steps in order and the
   settings as they are, kept true by the adapter's own test). For Vitec, then: the notification
   URL to give Vitec (with its token), where Connect is and the speed limits; the connections
   with their schedules (last catch-up, changes since, last comparison, the fetch list's counts,
   "Catch up now", "Compare now", "Resume now" when paused); the refused offices ("Probe now",
   "Forget"); and the fetch list (waiting, retrying, given up, with "Retry now" and "Drop").
7. **Settings.** Core's configuration as read from the environment, shown read-only (version,
   environment, page size, bell window, event and tombstone retention, gzip level, rules and
   schema versions, migrations applied, who may log in, the login mail, whether the email login
   is paused, the public URL, and where alerts go); the CRMs Core ships and what each can do;
   the start-over point per tenant, explained in plain words; run housekeeping now.
8. **Everywhere.** The environment (staging, production, local) on every page's header, the
   live-feed indicator, the version, and the command palette (⌘K or Ctrl+K) that jumps to a page,
   a tenant by name or number, or a record by id.

## Alerts

The worker compares the health checks with their last state every minute (`engine/alerts.ts`).
When a check turns red or green again, one message goes out by mail (`ALERT_EMAIL`, through the
same Postmark sender as the login links) and to a Slack incoming webhook (`ALERT_SLACK_WEBHOOK_URL`),
with what changed and a link to the panel (`PUBLIC_URL`). A check is told once per change, not
every minute; a check first seen green is not told at all. Every send is an `alert.sent` event.

## Times

Every time on the panel is shown in Swedish time (Europe/Stockholm) as `2026-09-18 22:14:05`, and
the footer says so; hovering a time shows the exact moment in UTC. Core itself stores and sends
only moments (UTC with an offset), never wall-clock times; the zone is a display choice made in
one place (`admin/src/lib/format.ts`).

## Not built

The Coulds of `docs/admin-panel-rebuild.md`, on purpose: users and roles (whoever reads mail at an
allowed domain is an operator), passkeys, a tenant with two CRMs, archiving a tenant, exports,
saved searches, a record's earlier versions, usage figures, uptime over a week, replaying a
notification, rotating the admin secret from the panel, dark mode and keyboard shortcuts beyond
the palette; and the Won'ts: the panel in Swedish, a customer-facing portal, editing data by hand.

## What it takes from the adapter API

Approved 2026-09-20 with the rebuild (questions 57 and 61): `Adapter.admin` describes the
adapter's panel as data, and one more lifecycle event names records to fetch again.

```ts
admin?: {
  /** The login form of a connection; the values become one JSON document, never shown back. */
  credentials: AdminField[];
  /** The directions at the top of the adapter's page: steps, and the settings as they are. */
  directions(): AdminDirections;
  /** The adapter's page: sections of key-values, tables with row actions, and actions. */
  panel(connections: Connection[]): Promise<AdminSection[]>;
  /** What the adapter knows about one connection, shown on its tenant's page. */
  connection?(connection: Connection): Promise<AdminSection[]>;
  /** Run an action a section declared; the message goes to the person who pressed it. */
  act(action: string, params: Record<string, string>, connections: Connection[]): Promise<{ message: string }>;
  /** Try the CRM with a login before it is saved. */
  probe?(credentials: string, officeIds: string[]): Promise<{ ok: boolean; detail: string }>;
  /** Fetch one record and map it, writing nothing; null when the CRM has no such record. */
  inspect?(connection: Connection, record: AdminRecord): Promise<{ raw: unknown; mapped: MappedRecord | null } | null>;
  /** What waits on the adapter's own fetch list, for the live activity list. */
  queue?(connections: Connection[]): Promise<AdminQueued[]>;
};

/** Delivered like the other lifecycle events: the adapter puts these records on its list. */
type Refetch = { type: 'refetch'; connection: Connection; records: AdminRecord[] };
```

The engine hands the descriptions to the app as they are and runs the actions the adapter
declared; it never inspects what they mean. This is the generic capability any adapter can use.
