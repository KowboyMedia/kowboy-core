# Admin area v3: the design

The third panel, designed from the requirement sheets alone: the use cases of
`docs/admin-panel-rebuild.md` §1, the rated functions of §3 (every Must and every Should), the
rules of §8, and the patterns of comparable consoles read fresh on 2026-09-20 and cited below.
Nothing of the two removed panels is an input: not a page, a layout, a flow, a word or a line of
code, and no such code was read while this was written.

Patric on 2026-09-20: **"Admin area v3 build. Build the admin area as described."** That is §8's
rule 8 answered. §8's process steps 1 and 2 (the pattern study, the information architecture) are
sections 1 and 2 of this document; step 3's clickable design is the built app itself on staging,
since the build was asked for in the same breath — a static mock of pages that already answer
would be a second version of the same screens to keep true. What follows is therefore both the
design and the specification the code meets.

## 1. Pattern study

One row per use case. "Read 2026-09-20" means the page was fetched and read that day, not
remembered.

### U1 Onboard a customer

| Product                                                                                                                                     | What it does                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Airbyte** ([connection status](https://docs.airbyte.com/platform/cloud/managing-airbyte-cloud/review-connection-status), read 2026-09-20) | A connection is made in a wizard, then lives as one page with tabs; the status tab shows the connection's own state (Healthy, Failed, Running, Paused, Queued) and every stream under it with the time since the last record landed. |
| **Stripe** ([webhooks](https://docs.stripe.com/webhooks), read 2026-09-20)                                                                  | An endpoint is created in a short form, and its signing secret is revealed on the endpoint's own page with a click, not mailed or shown once.                                                                                        |
| **React-admin** ([list tutorial](https://marmelab.com/react-admin/ListTutorial.html), read 2026-09-20)                                      | Create and edit are the same form component with the same validation and the same buttons, so a person who has made one record can change any record.                                                                                |

**Chosen.** One page for a tenant, used to make it and to change it, with one Save (§3 A, Must,
and Patric three times: a connection is a setting of a tenant). Airbyte's wizard is rejected
because it splits making from changing and produces a connection page of its own. Stripe's
reveal-on-the-page pattern is taken for the token and the bell secrets: they are on the tenant's
page at all times with a copy button, never shown once. The state vocabulary is Airbyte's idea
kept, its words dropped: Core's own states are the health checks and the connection's own report.

### U2 Keep it healthy, U5 Watch the flow

| Product                                                                                                                                     | What it does                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Airbyte** ([connection status](https://docs.airbyte.com/platform/cloud/managing-airbyte-cloud/review-connection-status), read 2026-09-20) | Status first, history second: the verdict at the top, then sync-history graphs, then troubleshooting for the failed run.                          |
| **Sentry** ([alerts](https://docs.sentry.io/product/alerts/), read 2026-09-20)                                                              | An alert's own page shows how often it fired, the most recent runs and the configuration behind it, so the alert explains itself.                 |
| **Stripe** ([webhooks](https://docs.stripe.com/webhooks), read 2026-09-20)                                                                  | Deliveries are listed as Delivered, Pending or Failed, and the failure's HTTP status and the time of the next attempt are on the delivery itself. |

**Chosen.** The first page is the verdict and nothing else above the fold: green or red, then one
row per health check with the reason for a red one and a button that goes where it is fixed. Under
it, the day in figures and the sites' freshness. The flow is a page of its own, because Patric
described it as one list and not a widget: the queue, colour coded by state, tailed live
(§8 rule 3). Stripe's "the failure carries its own next attempt" is taken: a queued row shows its
attempt count and when it is due, so nobody opens a second page to learn whether to wait.

### U3 Support a customer

| Product                                                                                                                                         | What it does                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Airbyte** ([connection timeline](https://docs.airbyte.com/platform/cloud/managing-airbyte-cloud/review-connection-timeline), read 2026-09-20) | One timeline per object with filters by event type and period, mixing syncs, setting changes and system actions in one chronological list. |
| **Stripe** ([webhooks](https://docs.stripe.com/webhooks), read 2026-09-20)                                                                      | Click an event to see its metadata and every delivery attempt; resend is on the event.                                                     |
| **React-admin** ([list tutorial](https://marmelab.com/react-admin/ListTutorial.html), read 2026-09-20)                                          | The list's sort, page and filters live in the URL, so a filtered view is bookmarkable and can be pasted to a colleague.                    |

**Chosen.** A records grid whose every filter, sort, page and column choice is in the address bar,
so "the record Patric is asking about" is a link. The record's page puts the CRM's payload, the
unified record and the prepared strings next to each other and the timeline under them, filtered
the Airbyte way, and the actions that answer the question (fetch again, recompute, ring the site,
look at the CRM now) sit on that page rather than on a tools page.

### U4 Release safely

| Product                                                                                                                                     | What it does                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Airbyte** ([connection status](https://docs.airbyte.com/platform/cloud/managing-airbyte-cloud/review-connection-status), read 2026-09-20) | "Refresh all historical data" and "clear synced data" are per-stream menu items with a confirmation, not global buttons. |
| **Stripe** ([webhooks](https://docs.stripe.com/webhooks), read 2026-09-20)                                                                  | A retry is explicit and bounded, and the console says how many attempts remain and when.                                 |
| **Sentry** ([alerts](https://docs.sentry.io/product/alerts/), read 2026-09-20)                                                              | Every long-running thing has a run history with its configuration attached, so a run can be read back later.             |

**Chosen.** One Manual sync page (called Runs until Patric renamed it on 2026-09-21) where the
scope is built once (everything, a CRM, a tenant, a
connection, an office, a datatype, a record, a selection, or only stale rules) and then either
previewed or run. Preview always comes first and writes nothing; running queues a job with
progress, cancel, a result and a history, the Sentry way: the job row keeps the scope it ran.
Every destructive run is a red button with a confirmation that says what will happen (§8 rule 2).

### U6 Licences and secrets, U7 Configure an adapter

| Product                                                                                                                                         | What it does                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stripe** ([webhooks](https://docs.stripe.com/webhooks), read 2026-09-20)                                                                      | Rolling a signing secret is a menu item on the endpoint, with the choice to expire the old one at once or later, and the new value shown in place. |
| **Sentry** ([alerts](https://docs.sentry.io/product/alerts/), read 2026-09-20)                                                                  | Where a message goes (Slack, email, webhook) is configuration a person reads on the page, not something to guess.                                  |
| **Airbyte** ([connection timeline](https://docs.airbyte.com/platform/cloud/managing-airbyte-cloud/review-connection-timeline), read 2026-09-20) | Setting changes are events in the same timeline as the work, so the audit trail and the operational log are one list.                              |

**Chosen.** Rotation is on the thing it belongs to (the tenant's token on the tenant, a site's bell
secret on the site), red, with a confirmation naming what breaks until the new value is pasted
into the site. Who did what is not a separate audit page: a panel save, a rotation and an action
are events with the person on them, in the one event log, filterable to `admin.*`. An adapter's
own page carries its directions, its settings and its notification URL exactly as the adapter
reports them.

### U8 Try things without leaving the browser

| Product                                                                                                                                     | What it does                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Stripe** ([webhooks](https://docs.stripe.com/webhooks), read 2026-09-20)                                                                  | Resend on a delivery, trigger a test event: trying is a button next to the thing, not a sandbox page. |
| **Airbyte** ([connection status](https://docs.airbyte.com/platform/cloud/managing-airbyte-cloud/review-connection-status), read 2026-09-20) | Per-stream actions live in the row's menu, so what is tried is unmistakably scoped to that row.       |
| **React-admin** ([list tutorial](https://marmelab.com/react-admin/ListTutorial.html), read 2026-09-20)                                      | Bulk actions apply to the ticked rows and nothing else.                                               |

**Chosen.** There is no tools page. Pull as a site and ring are on the site; fetch again, recompute
preview and look at the CRM are on the record and on the ticked selection; a lifecycle event is on
the connection it concerns. Everything writes to the same event log, so a try is visible afterwards.

### The frame (§3 I, every page)

| Product                                                                                         | What it does                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Refine** ([data provider](https://refine.dev/docs/data/data-provider/), read 2026-09-20)      | One data provider with `getList`, `getOne`, `create`, `update`, `deleteOne` and `custom`; `getList` takes pagination, sorters and filters and returns `{ data, total }`.                                    |
| **Refine** ([live provider](https://refine.dev/docs/realtime/live-provider/), read 2026-09-20)  | A live provider's `subscribe`/`unsubscribe`, with `liveMode: "auto"` invalidating the queries a published event touches.                                                                                    |
| **shadcn/ui** ([data table](https://ui.shadcn.com/docs/components/data-table), read 2026-09-20) | There is no one data-table component: a table is built from the `Table` primitives with the features it needs — sorting, filtering, pagination, row selection, column visibility — and extracted for reuse. |

**Chosen.** Exactly this, as the documentation says (§8 rule 7): one Refine data provider over
Core's admin API, `liveMode: "auto"` fed by one server-sent event stream, and one `DataTable`
component built the shadcn way and used by every list in the app. shadcn's guide reaches for
TanStack Table for the work a browser does to a table it holds — sorting, filtering, paging in
memory. Core's lists do none of that: the filters, the sort and the page are the server's, because
a tenant may hold a hundred thousand records. What is left is declaring the columns and drawing
them, so the `DataTable` is the shadcn primitives plus a column list, and no table library is
added. Adding one would be a dependency for nothing (AGENTS.md: simple beats clever).

## 2. Information architecture

Eight destinations, one level, no nesting. A connection is nowhere in the navigation (§8 rule 1).

```
┌ top bar ── environment · version · deployed at ─────── ⌘K ── signed in as ── sign out ─┐
│ Overview   the verdict, the day, the sites                                              │
│ Flow       the colour-coded queue, live                                                 │
│ Records    search → one record                                                          │
│ Tenants    list → one tenant (licence · token · connections · sites)                    │
│ Manual sync  scope → preview → job                                                      │
│ Events     the log, filters, live tail, who did what                                    │
│ CRMs       one page per adapter, as the adapter reports it                              │
│ Settings   configuration, versions, maintenance, housekeeping, access                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Overview — U2, U5

The verdict first: one line, green or red, then a card per health check with its detail in plain
words, the names behind a count, and a link to where it is fixed. Then the day: records written,
pulls, bells, CRM calls and failures per hour over 24 hours; records per datatype per tenant; every
site with its last pull and last bell. Open jobs appear here while they run. Empty Core shows "no
tenant yet" with the button that makes one.

### Flow — U5

One list, newest queued first, the whole row coloured by state: **queued** (waiting for the CRM),
**fetching**, **written** (in Core), **applied** (a site took it), **error** (red). Columns:
tenant, office, entity type, record id, state, queued at, what happened, attempt, the site's
report. It tails live and rows change state in place. Its data is the engine's write path (the
event log) plus each adapter's `queue()`.

### Records — U3

The grid: server-side filters (tenant, CRM, connection, office, datatype, id, written between,
removed, words in the record), sort by any column, pages of 25 to 500, a column chooser, ticked
rows. Everything in the address bar. Ticked rows act: recompute (preview or run), fetch again from
the CRM, ring the tenant's sites. A saved view is a link.

One record: three panes side by side — the CRM's payload, the unified record, the prepared strings
and sections — and under them the timeline of everything that touched it, from the CRM's
notification to each site's apply. On the page: fetch again, recompute (preview first), ring, and
"ask the CRM now", which fetches and maps without writing.

### Tenants — U1, U6

The list is a list of tenants only. One tenant is one page and one Save: name, licence on or off,
its connections (any number, of any CRM, each with the CRM's own login fields, its offices, a
"check the login" button and the adapter's own report of that connection), and its sites (name,
bell URL, bell secret). The token and every bell secret have a copy button. Rotation and deletion
are red with a confirmation. A site shows its own last pull, its last bell and its answer, its
setup checklist (secret and token in the site, first bell answered, first pull done, first apply),
what it reported applied and failed, and its own errors.

### Manual sync — U4

Scope, then preview, then run. The scope builder is one form, and the same component Records
filters with (Patric, 2026-09-21): a tenant, then that tenant's connections, then that
connection's offices, then the kind of record — each picked from a box, none typed — plus one
record id, the current selection, the search itself, and only records an older rules version made. Preview reports examined, changed, unchanged, failed, the first failures with
their errors and the first examples with their changed fields, and writes nothing. Run queues a
job: progress, cancel, result, and a history of every run with the scope it ran. Fetch again from
the CRM uses the same scope builder. Housekeeping is a button here.

### Events — U3, U6

The log with filters (type, tenant, connection, site, record, correlation id, from, to), newest
first, paged by event number, with a live tail. Following a correlation id is one click on an
event. Panel logins, saves and actions are events of type `admin.*` with the person on them, so
"who did what" is a filter, not a second page.

### CRMs — U7

One page per adapter that registered, drawn from what the adapter reports: its setup directions in
order, its settings as they are, its notification URL, and its sections — key-values, tables with
row actions, and buttons. The panel never knows what any of it means. A second CRM appears here by
itself.

### Settings — U6, U7, H

Configuration read only (no secret values, only whether each is set), the migrations the database
holds, the rules and schema versions, where alerts go, the maintenance switch, housekeeping, who
may sign in, and this session.

### Every Must and every Should, placed

| §3  | Function                                               | Page                                |
| --- | ------------------------------------------------------ | ----------------------------------- |
| A   | One page for a tenant, one Save; edit is the same page | Tenants → tenant                    |
| A   | Save without a reload, a toast, errors at the field    | Tenants → tenant                    |
| A   | Checks while typing                                    | Tenants → tenant                    |
| A   | Copy buttons for token and bell secrets                | Tenants → tenant                    |
| A   | Check the login before saving (probe)                  | Tenants → tenant → connection       |
| A   | First-load progress                                    | Tenants → tenant → connection       |
| A   | One or several CRMs per tenant                         | Tenants → tenant                    |
| B   | Dashboard with figures and 24-hour charts              | Overview                            |
| B   | Health checks with the reason for a red one            | Overview                            |
| B   | Live activity, and what is queued                      | Flow                                |
| B   | Per-connection status with "run now"                   | Tenants → tenant → connection       |
| B   | Alerts by mail or Slack                                | engine; shown on Settings           |
| B   | Environment banner, version, deploy time               | top bar, every page                 |
| C   | Search with server-side filters                        | Records                             |
| C   | Sort by any column, pages 25–500, column chooser       | Records                             |
| C   | Tick rows and act on them                              | Records                             |
| C   | One record: raw, unified, display, timeline            | Records → record                    |
| C   | Preview a recompute for one record                     | Records → record                    |
| C   | Free-text search across a record                       | Records                             |
| C   | Records failing the schema, with their errors          | Manual sync → preview failures      |
| D   | Recompute by scope                                     | Manual sync                         |
| D   | Fetch again by scope                                   | Manual sync                         |
| D   | Preview first, then run                                | Manual sync                         |
| D   | Jobs: progress, cancel, result, history                | Manual sync                         |
| D   | Impact preview before a release                        | Manual sync → preview               |
| D   | Housekeeping now                                       | Manual sync                         |
| E   | Sites per tenant, ring, new bell secret                | Tenants → tenant                    |
| E   | Site setup checklist                                   | Tenants → tenant → site             |
| E   | What a site holds versus Core                          | Tenants → tenant → site             |
| E   | The site's own errors                                  | Tenants → tenant → site             |
| F   | The event log with filters and correlation             | Events                              |
| F   | Who did what on the panel                              | Events, type `admin.*`              |
| G   | Pull as a site, ring, lifecycle event, preview         | the site, the tenant, the record    |
| G   | Look at a CRM record, nothing written                  | Records → record                    |
| H   | Configuration, migrations, versions                    | Settings                            |
| H   | Token and bell secret rotation                         | Tenants → tenant                    |
| H   | Login by email link, the maintenance switch            | sign-in page; Settings              |
| H   | Adapter settings, directions, notification URL         | CRMs                                |
| H   | A second CRM appears by itself                         | CRMs, and the tenant's CRM list     |
| I   | No full-page reloads                                   | every page                          |
| I   | A toast for every outcome, undo where safe             | every page                          |
| I   | One pattern for list, detail, form, row actions        | every page                          |
| I   | Confirmations that say what will happen                | every dangerous button              |
| I   | Empty states that say what to do next                  | every list                          |
| I   | Responsive and accessible                              | every page                          |
| I   | Live updates                                           | Overview, Flow, Manual sync, Events |
| I   | Command palette                                        | ⌘K, every page                      |

The Coulds of §3 and §6 are not built and stay listed there. The three Won'ts are not built.

## 3. How it is built

- **The API is the product's one code path.** Everything the app does is a call to `/v1/admin/…`,
  the same JSON an agent calls. No panel logic lives in the browser that an agent cannot reach.
- **Refine as its documentation says**: one data provider over that API, resources for the lists,
  `liveMode: "auto"` driven by one `EventSource` on `/v1/admin/stream`.
- **shadcn/ui components** copied into `admin/src/components/ui`, Tailwind for layout, one
  `DataTable` built the shadcn way and used by every list.
- **One build.** `npm run build` compiles the engine with `tsc` and the app with Vite into
  `dist/admin`, which the web process serves under `/admin`. Nothing is hosted elsewhere.
- **Every journey is a browser test** (`admin/e2e`), run against a Core started as the tests start
  it, and named in the acceptance report.
