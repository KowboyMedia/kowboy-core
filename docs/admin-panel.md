# Admin panel

**There is no admin panel today.** The first panel (approved 2026-09-18, question 29) and the
rebuild of 2026-09-20 were both removed on 2026-09-20 at Patric's word: the rebuild had inherited
the pages, layouts and user flows of the first one, and nothing of either may be inherited into
the next. The next panel is designed from the requirement sheets first
(`docs/admin-panel-rebuild.md`: the use cases in §1, the rated functions in §3, the design brief
in §8), its screens are approved before any code, and it is not built until Patric says so.

**This file describes the panel as it is.** A change to a page, an action, a setting, a lifecycle
event or a health check changes this file, the panel's own words and the adapter's setup
directions in the same change (AGENTS.md, definition of done, Patric 2026-09-20). The test
`adapters/vitec/admin/directions.test.ts` keeps the directions honest (every setting, lifecycle
event, health check and credential field is named).

## What the engine offers a panel today

The engine's operations are functions, one code path each, that the acceptance tests drive
directly (`acceptance/operations.test.ts`, `acceptance/entrypoint.test.ts`) and that the panel's
API will call when it exists:

- **Tenants, connections and sites** (`engine/storage/connections.ts`): make and change a tenant,
  its connections (one or several, of the same or different CRMs) and its sites; rotate a token
  or a bell secret; delete a site, which takes its history in the event log with it (Patric,
  2026-09-20).
- **Lifecycle events** (`engine/lifecycle.ts`): `connection_added`, `offices_added`,
  `offices_removed`, `resync` and `refetch` (named records fetched again) are queued in
  `lifecycle_events` and delivered to the adapter by the worker.
- **Recompute** (`engine/recompute.ts`): any scope (everything, a CRM, a tenant, a connection, an
  office, a datatype, one record, a list, or only records an older rules version made), as a
  preview that writes nothing or for real, in pages of 200 records with progress. Long runs are
  jobs (`engine/jobs.ts`) the worker takes, with progress, a result, cancel and a history.
- **Records** (`engine/storage/items.ts`): search with server-side filters, words in the unified
  record (a full-text index), sort by any column, pages and a total.
- **The event log** (`engine/events.ts`): the timeline query by record, connection, tenant, site,
  correlation id, type and time, paged by event number, newest first or oldest first. A `pull`
  event names the site that pulled (the `X-Core-Site` header both clients send: their own bell
  URL). A Vitec notification is stored whole in its `webhook.received` event for as long as the
  log keeps events, 30 days (Patric, 2026-09-20, question 63).
- **Bells** (`engine/bells.ts`): ring every site of a tenant, or one of them, for changes or for
  everything.
- **Health** (`engine/health.ts`): the checks of the engine and of every adapter. `GET /v1/health`
  is public, for an uptime monitor: 200 when every check passes, 500 when any fails, each check
  with a detail in counts and plain words and never a customer's name (Patric, 2026-09-20,
  question 62). The names behind a count (`names` on a check) reach the alerts and the panel, not
  the public answer.
- **Alerts** (`engine/alerts.ts`): when a check turns red or green again, one message by mail
  (`ALERT_EMAIL`, through Postmark: `POSTMARK_SERVER_TOKEN`, `MAIL_FROM`) and to a Slack incoming
  webhook (`ALERT_SLACK_WEBHOOK_URL`), with the detail, the names and a link to the health page
  (`PUBLIC_URL`). Told once per change, never every minute; a check first seen green is not told.
  Every send is an `alert.sent` event.

## What the adapter API offers a panel

Approved 2026-09-20 with the rebuild (questions 57 and 61) and kept: `Adapter.admin` describes
the adapter's panel as data, and one more lifecycle event names records to fetch again. The
Vitec adapter implements all of it (`adapters/vitec/admin/`), proved by its tests named AC 42.

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
  /** What waits on the adapter's own fetch list, for the queue list. */
  queue?(connections: Connection[]): Promise<AdminQueued[]>;
};

/** Delivered like the other lifecycle events: the adapter puts these records on its list. */
type Refetch = { type: 'refetch'; connection: Connection; records: AdminRecord[] };
```

The engine hands the descriptions on as they are and runs the actions the adapter declared; it
never inspects what they mean. This is the generic capability any adapter can use.
