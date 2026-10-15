---
name: admin-debloat-item-27
description: State of the "Debloat admin" thread (item 27): new Flow, Records, Manual sync and Events on staging, the shared scope, and what each of Patric's answers built
metadata:
  type: project
  modified: 2026-10-06T20:26:55.704Z
---

Item 27, "Debloat admin" thread, started 2026-10-06 18:52Z from Patric's "We need to debloat admin".

- **Built on staging 2026-10-06 (fdaf26e, review fixes 8836e2b):** Flow ("Queued at" first and sorted by it, top 100, re-read every second while open, tenant and office boxes), Records (built from zero: same scope as Manual sync, Live/Removed/Both explained beside the buttons, name or row opens the record), and a new Manual sync at `/sync` beside the old page ("Manual sync (old)" at `/manual-sync`). Three levels via `POST /v1/admin/runs/sync` (`level` fetch | recompute | send, scope checked by `scopeFromBody`); every level ends with "send": new `seq` values for the scope's live records (`renumber`) and a ring per tenant.
- **Send semantics (decision 2026-10-06, smaller option):** a site takes what it lacks or holds in another version; a record it holds unchanged is left as is (WordPress plugin and Lovable kit skip an unchanged content hash). A forced rewrite would need a contract change and both clients; not built.
- **One scope everywhere:** tenants, offices, entity types (comma lists) and one record id; address and API keys `tenant`, `office`, `datatype`, `id`. The id box keeps what is typed; what is sent is trimmed. The router runs with `useTransitions={false}` so the id box loses no keys. An office id two tenants hold is ticked under both and named per tenant. The "Needs attention" link is `/records?tenant=T&office=O` (Records shows live and removed together since ce06816).
- **Flow read cost:** queries run one after another (one pool connection at a time), at most 100 rows from the database, bounded to the last day and 1000 events; adapters are asked only about the connections of the tenants in scope (Vitec `queue` filters its fetch list by those connections' offices, each in its own environment since d8f24cc). No new pool ([[database-connection-budget]]).
- **Gone:** words search and its index (migration 013), row ticking, select-all, `/records/columns`, housekeeping's button and route (the worker still runs it).
- **Done 2026-10-07 on staging:** 176 (old Manual sync gone, 64e888f), 180 (editable connection names, ce06816; switches dropped, 48e0fd5, migration 018), 182 a and 183 (old pages and unnamed parts gone), 168 a (Events rebuilt from zero, e6d9209: `engine/admin/event-log.ts`, GET /events takes only `page` and `correlation`).
- **Local gotcha:** dist/ keeps a renamed migration's stale copy; running dist records it and health/restore tests fail "database ahead of the app". Delete the dist file and its local `migrations` row.
