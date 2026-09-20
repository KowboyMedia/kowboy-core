# Admin panel

Approved 2026-09-18 (question 29), built the same day and grown since: `engine/admin/` and
`adapters/vitec/admin/`, tested as AC 42. One place, in a browser, to configure Core and its
adapters and to see what is happening, so that nothing needs a database client, a script or a
console.

**This file describes the panel as it is.** A change to a page, an action, a setting, a lifecycle
event or a health check changes this file, the panel's own words and the adapter's setup
directions in the same change (AGENTS.md, definition of done, Patric 2026-09-20). Two tests keep
the directions honest: `adapters/vitec/admin/directions.test.ts` (every setting, lifecycle event,
health check and credential field is named) and the acceptance test that every page a direction
names exists on the panel.

## Shape

- **Where it runs.** Inside the `web` process, under `/admin`, behind a login by email link (no
  shared password, Patric 2026-09-18): the form takes an address, and when its domain is on the
  allowed list (`ADMIN_EMAIL_DOMAINS`) a link goes there by mail; the page answers the same way
  whatever the address, so the list stays private. The link lasts 15 minutes and opens a session
  for the browser session, or for 30 days with "Remember this device" ticked. A CSRF token on
  every form. The mail goes through Postmark (`POSTMARK_SERVER_TOKEN`, `MAIL_FROM`), at most one
  link per address per minute and ten a day in all. While a mailbox is in maintenance,
  `ADMIN_LOGIN_WITHOUT_EMAIL=true` lets an allowed address in straight from the form (Patric,
  2026-09-19); every attempt is logged as `admin.login`, and the Settings page shows the switch.
  Users and roles come later.
- **How it is built.** Server-rendered HTML from TypeScript template functions on top of Tabler,
  the open-source admin UI kit on Bootstrap 5 (Patric, 2026-09-18: a market-leading component
  library, a professional and responsive look). JSON is shown with jsoneditor, read-only (Patric,
  2026-09-19), the minimalist build. Charts and figures are inline SVG and plain HTML drawn by
  `engine/admin/charts.ts` in Tabler's colours (blue, orange, teal, purple as series, validated
  for colour-blindness and contrast; red only for what failed), with a legend, hover readouts and
  a table twin for every chart; no chart library. Core serves every stylesheet and script itself,
  so the panel depends on no outside host; nothing to build. Every page is a title, one line on
  what it is for, and cards that each say what they show or do, with a line of help under every
  field, so a cold reader can follow. Every panel reads the same tables the engine and adapters
  use, and writes through the same functions the scripts and the admin API use: one code path per
  concern. The pages carry Cloudflare's `email_off` markers, so the platform's edge leaves email
  addresses as they are (Patric, 2026-09-20).
- **Where the code lives.** `engine/admin/` holds the shell (login, navigation, layout, the panel
  registry), the Core pages, `stats.ts` (the numbers, from the event log, the items and the
  subscribers) and `charts.ts` (figures and charts). `adapters/<provider>/admin/` holds that
  adapter's settings and pages, which the adapter hands to the engine through the adapter API; the
  shell renders them in place without knowing what they show. The seam holds: no CRM name in
  `engine/`.
- **Tests.** Every page is driven through HTTP in the acceptance harness like the API is, and one
  acceptance criterion (AC 42) names those tests; `acceptance/entrypoint.test.ts` starts the web
  process exactly as deployed.

## Pages

1. **Dashboard** (`/admin`, the first page after login). Six figures: health (checks passing),
   live records (and removed ones), written in the last 24 hours with a sparkline per hour, sites
   up to date (pulled within the hour), bells in the last 24 hours (and unanswered ones), and what
   waits for the worker. Two charts per hour over the last 24 hours: records (written, removed in
   the CRM, dropped as malformed or unlicensed) and sites (bells, pulls, applied, failed). Then
   records per datatype, the sites' freshness meter with the pulls' answer times (typical and
   slowest 5 %), and everything else in the event log by type (the adapters' calls to their CRMs,
   notifications, logins, tests). Below: the health checks as `/v1/health` reports them, records
   per tenant and datatype, the last 20 events, the version and the migrations applied.
2. **Tenants.** The list (number, name, licence, CRM, sites) and "New tenant". One page makes a
   tenant and one page changes it, the same page, components and code path (Patric, 2026-09-20,
   the flow as he told it): the name and licence; the CRM connection, chosen from the CRMs Core
   ships, whose panel then asks for the login the adapter declares (stored encrypted, never shown
   again; leave it empty to keep it) and the offices; and the sites, one or many, each with its
   name, bell URL and active flag. One Save does it all: the tenant is made and gets its number
   and token, the connection is made (id `<crm>-<tenant number>`) and loaded from the CRM once
   the login is there (the event `connection_added`), an added office is loaded and a dropped
   one taken off the sites (`offices_added`, `offices_removed`), and every new site gets its
   bell secret. Below the form on an existing tenant: the token (shown at all times, "New
   token" retires it), the connection's state, the loads and actions (load everything, resync,
   remove everything), what the adapter knows, and the connection's latest events; each site
   row has a menu to ring it (delta or forcerefresh) and to make a new bell secret, and shows
   the secret. The token and the bell secret go into the site's own settings by hand. A
   disabled licence stops the bells and the pulls; the sites keep showing what they have. A
   connection or a site exists only inside its tenant, and nothing about a customer is made
   anywhere else.
3. **Connections** have no page of their own: an old connection link opens its tenant. What
   remains under `/admin/connections/<id>/event` is the action handler the tenant page posts to.
4. **Adapter pages.** One per adapter, from `adapters/<provider>/admin/`, under the CRM adapters
   heading. Every adapter page opens with its setup directions ("Set up Vitec"): the steps in
   order and the settings as they are, built from what the adapter reads and kept true by the two
   tests above (Patric, 2026-09-18). For Vitec, then: the notification URL to give Vitec (with its
   token), where Connect is and how many requests go at once; the connections with their
   schedules (last catch-up, last comparison, the fetch list's counts, "Catch up now", "Compare
   now", "Resume now" when paused); the refused offices ("Probe now", "Forget"); the fetch list
   (waiting, retrying, given up, with "Retry now" and "Drop"); and a page to fetch one record by
   hand: look at it (raw next to unified, nothing written) or queue it for the worker.
5. **Items.** Six figures: live and removed records, written, removed and dropped in the last 24
   hours, applied and failed at the sites. A search by tenant, connection, entity type, office,
   record id, the days it was written, removed or not, and how many at most (newest first, up to
   500); the results have a box per row and "Recompute selected". The live activity list: the last
   100 records through the write path, newest first, the whole row coloured by state (fetched,
   fetched and applied by a site, error: dropped or failed at a site), with what happened, which
   site reported and the correlation id; it refreshes itself every five seconds and lights up new
   rows. Queued records (yellow, sorted with the rest by time) and "Update from CRM" for a
   selection wait on register question 57, two additive adapter capabilities. One record's page:
   where it comes from, its place in the change sequence and when it was written; raw, unified
   and display side by side as JSON viewers; recompute it; its timeline from the event log, down
   to what each site applied (question 37). Never a hand edit of data.
6. **Events.** The timeline query of strategy §8.2: filter by tenant, connection, type, correlation
   id, one record, a time range and a limit; a value that is not a date is left out and said so,
   a limit that is not a whole number above zero is the default; follow a correlation id from a
   webhook to the writes, bells and pulls it caused.
7. **Test page.** Run a request and see the answer, without leaving the browser: as a site,
   `GET /v1/changes` for a tenant, a datatype and a cursor, with the response and its size plain
   and gzipped; as an operator, a bell, a lifecycle event, and a recompute or its preview, with
   what they returned. Every run is logged as `admin.test`. Requests against a CRM live on the
   adapter's own page (for Vitec: fetch one record).
8. **Settings.** Core's configuration as read from the environment, shown read-only (version,
   page size, bell window, event and tombstone retention, gzip level, migrations applied, who may
   log in, the login mail, whether the email login is paused); the start-over point per tenant,
   explained in plain words (the position up to which deletion markers are gone, so a site that
   pulled before it is told to pull everything again); run housekeeping now (tombstone purge,
   event retention).

One rule for every button (Patric, 2026-09-19): a card's own action is a blue button, a secondary
action next to other things is a small outlined one, a removal is a red outlined one, and a row's
actions sit in one menu. Filters and forms offer tenants, connections and datatypes as dropdowns,
never as free text.

## Times

Every time on the panel is shown in Swedish time (Europe/Stockholm) as `2026-09-18 22:14:05`, and
the footer says so; hovering a time shows the exact moment in UTC. Core itself stores and sends
only moments (UTC with an offset), never wall-clock times; the zone is a display choice made in
one place (`engine/admin/html.ts`).

## Not built

Users and roles (whoever reads mail at an allowed domain is an operator; roles come when they are
needed), editing data by hand, more than one language, anything a site does (templates, search),
and, until question 57 is answered, queued records in the live list and "Update from CRM" for a
selection.

## What it takes from the adapter API

Approved 2026-09-18, one additive field on `Adapter`:

```ts
admin?: {
  /** The credentials form for a connection, rendered by the shell; values are never shown back. */
  credentials: { key: string; label: string; secret: boolean }[];
  /** Pages under /admin/<provider>/…, rendered inside the shell. */
  panels: { path: string; title: string; handle(request: AdminRequest): Promise<AdminResponse> }[];
  /** The status fragment shown under a connection. */
  connectionStatus?(connection: Connection): Promise<string>;
};
```

The engine mounts the pages, wraps them in the shell and passes the request through; it never
inspects what they render. This is the generic capability any adapter can use.

Proposed 2026-09-20 (register question 57), two more additive pieces, so the live list can show
what still waits on an adapter's own list and a selection can be fetched again from the CRM:

```ts
admin?: {
  // …as above, and:
  /** What waits on the adapter's own fetch list, oldest first, for the panel's live activity list. */
  queue?(): Promise<
    {
      connectionId: string;
      officeId: string;
      datatype: Datatype;
      remoteId: string;
      queuedAt: string;
      reason: string;
      attempts: number;
      nextAt: string | null;
      lastError: string | null;
    }[]
  >;
};

/** One more lifecycle event, delivered like the others: the adapter puts these records on its list. */
type Refetch = { type: 'refetch'; connection: Connection; records: { datatype: Datatype; remoteId: string }[] };
```
