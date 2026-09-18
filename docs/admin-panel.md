# Admin panel: the MVP

Approved and built 2026-09-18 (question 29): `engine/admin/` and `adapters/vitec/admin/`, tested as AC 42. One place, in a browser, to
configure Core and its adapters and to see what is happening, so that nothing needs a database
client, a script or a console. Everything an agent does for an operator today (tenants,
connections, lifecycle events, health, the event log) becomes a panel.

## Shape

- **Where it runs.** Inside the `web` process, under `/admin`, behind a login by email link (no
  shared password, Patric 2026-09-18): the form takes an address, and when its domain is on the
  allowed list (`ADMIN_EMAIL_DOMAINS`) a link goes there by mail; the page answers the same way
  whatever the address, so the list stays private. The link lasts 15 minutes and opens a session
  for the browser session, or for 30 days with "Remember this device" ticked. A CSRF token on
  every form. The mail goes through Postmark (`POSTMARK_SERVER_TOKEN`, `MAIL_FROM`), at most one link per
  address per minute and ten a day in all. Users and roles come later.
- **How it is built.** Server-rendered HTML from TypeScript template functions on top of Tabler,
  the open-source admin UI kit on Bootstrap 5 (Patric, 2026-09-18: a market-leading component
  library, a professional and responsive look). Core serves Tabler's stylesheet and script itself,
  so the panel depends on no outside host; nothing to build. Every page is a title, one line on what
  it is for, and cards that each say what they show or do, with a line of help under every field,
  so a cold reader can follow. Every panel reads the same tables the engine and adapters use, and
  writes through the same functions the scripts and the admin API use: one code path per concern.
- **Where the code lives.** `engine/admin/` holds the shell (login, navigation, layout, the panel
  registry) and the Core panels. `adapters/<provider>/admin/` holds that adapter's settings and
  panels, which the adapter hands to the engine through the adapter API; the shell renders them
  in place without knowing what they show. The seam holds: no CRM name in `engine/`.
- **Tests.** Every panel is driven through HTTP in the acceptance harness like the API is, and
  one acceptance criterion (AC 42) names those tests.

## Panels

1. **Overview.** The health checks as `/v1/health` reports them, live; items per tenant and
   datatype (live and tombstoned); the worker's last heartbeat; the version and the migrations
   applied; the last 20 events. The first page after login.
2. **Tenants and sites.** Tenants: list, add, rename. Per tenant its sites (subscribers): label,
   bell URL, active, last pull, last bell and its status; add one; rotate its bell secret; show a
   tenant token once, rotate it; ring a site now (delta or forcerefresh).
3. **Connections.** Per tenant: the CRM (adapter), the credentials as a write-only form the
   adapter declares (never displayed), the licensed offices, active or not. Actions: add (runs the
   initial load), add or remove offices, resync, deactivate. Below the form, the adapter's own
   status fragment for this connection (for Vitec: last catch-up and comparison, what is waiting
   on the fetch list, records that keep failing).
4. **Adapter panels.** One per adapter, from `adapters/<provider>/admin/`. For Vitec: the webhook
   URL to give Vitec (with its token), the fetch concurrency; the fetch list (waiting, retrying,
   given up, with "retry now" and "drop"); catch-up and comparison per connection with "run now";
   "fetch this id now" and "list this office now" for one record or one office.
5. **Items.** Find an item by datatype and id, or browse an office. Show its envelope (seq, hash,
   deleted, dates) and its three faces side by side: raw, unified (`data`) and display. Its
   timeline from the event log, down to what each site applied (question 37). Actions: recompute this item; refetch it through the adapter.
   Never a hand edit of data.
6. **Events.** The timeline query of strategy §8.2: filter by tenant, connection, datatype, id,
   type and time; follow a correlation id from a webhook to the writes, bells and pulls it caused.
7. **Test panel.** Run a request and see the answer, without leaving the browser:
   - as a site: `GET /v1/changes` for a tenant, a datatype and a cursor, with the response and its
     size, compressed and plain;
   - as an operator: bell, lifecycle event, replay, recompute and the recompute preview, with what
     they returned;
   - through an adapter, read-only against the CRM with a connection's credentials: for Vitec,
     get one estate by id or list one page of an office, and see the raw answer next to what the
     mapper makes of it (unified and display), a dry run that writes nothing.
     Every run is logged as an event with who ran it.
8. **Settings.** Core's configuration as read from the environment, shown read-only (page size,
   bell throttle, event retention, gzip level); the purge watermark per tenant; run housekeeping
   now (tombstone purge, event retention).

Order of building: 1, 3 with the Vitec fragment, 5, 7, 6, 2, 8.

## Times

Every time on the panel is shown in Swedish time (Europe/Stockholm) as `2026-09-18 22:14:05`, and
the footer says so; hovering a time shows the exact moment in UTC. Core itself stores and sends
only moments (UTC with an offset), never wall-clock times; the zone is a display choice made in
one place (`engine/admin/html.ts`).

## Not in the MVP

Users and roles (whoever reads mail at an allowed domain is an operator; roles come when they are
needed), editing data by hand, charts, more than one language, anything a site does (templates,
search).

## What it takes from the adapter API (approved)

One additive field on `Adapter`:

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

The engine mounts the panels, wraps them in the shell and passes the request through; it never
inspects what they render. This is the generic capability any adapter can use, and the only
change to the protected adapter API the MVP needs.
