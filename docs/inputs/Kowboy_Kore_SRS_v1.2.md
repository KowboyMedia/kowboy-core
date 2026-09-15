# Kowboy Kore - Software Requirements Specification

**Version:** 1.2 (2026-09-09) · **Owner:** Kowboy Media (Eightzero AB), Gothenburg · **Status:** Request for quotation

## Purpose and context

Kowboy Media builds and hosts websites for Swedish real estate brokerages. Every brokerage runs a CRM (Vitec or Mspecs) that holds its properties, agents, offices, areas and housing associations, and every website must show that data automatically. Today this integration lives inside a WordPress plugin per site. Kowboy is replacing it with **Kore**: one central service that reads the CRMs, normalizes the data into a single model, and lets any website pull it by cursor. Websites are "subscribers"; the first two are a thin WordPress plugin and a Lovable (React + Supabase) site.

**What is being quoted:** Kore itself (§1-§13), the WordPress reference client (Appendix A) and the Lovable reference client (Appendix B). Please price the three parts separately as well as together. Kowboy supplies CRM credentials for a test account per provider, real anonymized CRM payloads, an edge-case ledger of business rules from 13 years of production, and a human reviewer. Please quote a fixed price and a delivery date, and state any assumption this document leaves open.

> **Operating constraint (hard requirement):** simplest possible design, fewest moving parts, no enterprise features, buildable and maintainable by AI coding agents with one human reviewer. When two designs both work, the one with less code wins. Nothing in this document is "designed for later".

## 1. System

```
CRM (Vitec, Mspecs)
      │  adapters pull and receive webhooks, on their own schedule
      ▼
KORE  = one Node process + one Postgres
      │  POST bell (fire and forget)          ▲
      ▼                                       │ GET /v1/changes?after=<seq>
SUBSCRIBER (WordPress plugin, Lovable site, ...) - renders from its own local store only
```

Kore pulls from CRMs, normalizes into one canonical model, applies business rules, stores the result, and lets subscribers pull changes by cursor. Subscribers keep a full local copy and never render from Kore.

### Principles

1. One repo, one process, one database. Adapters are folders, not services.
2. Subscribers render from local data only. Kore down means stale data, never a down site.
3. Every operation is idempotent and safe to retry.
4. All data logic lives in Kore. Subscribers are templates plus a sync loop. No CRM name may appear in subscriber code.
5. Kore stores, never searches. Filtering, sorting, geo, sitemaps are subscriber concerns (§9).
6. Serialized ingest: one writer at a time (in-process mutex), so `seq` order equals commit order.
7. Contract changes are additive by default. Breaking changes bump `schema_version`.

## 2. Glossary

| Term | Meaning |
|---|---|
| Tenant | A customer (brokerage). Immutable slug `t_acme`, mutable `display_name`. Holds one subscriber token. |
| Connection | One credential set for one CRM provider, owned by one tenant. Slug `vitec-acme`. A tenant may have several. |
| Provider | `vitec` or `mspecs`. A property of a connection. |
| Office | A CRM office. An entity in the data and the unit of licensing. A 10-office chain is one tenant, one or more connections, ten offices. |
| Adapter | Kore module for one provider. Owns everything CRM-specific, including when to fetch (§4). |
| Subscriber | A consumer of one tenant's data: a WordPress site, a Lovable site, a dashboard. Has a bell URL. |
| Bell | Fire-and-forget HTTP POST from Kore to a subscriber URL meaning "something changed, come pull". |
| Association | A Swedish housing cooperative (bostadsrättsförening) that an apartment belongs to. Referenced by properties. |
| Item / datatype | One canonical record. `datatype` in `property`, `agent`, `office`, `area`, `association`. |
| Raw payload | The provider's untouched response for one record, stored by Kore next to the canonical item (§4, §7). |
| CanonicalEntity | What a mapper returns for one record: canonical fields, relationships by remote id, coordinates. Provider-shaped keys never appear in it. |
| `seq` | Kore-assigned, globally increasing integer set on every content change. The only cursor. |
| `content_hash` | SHA-256 over canonical `data` excluding `provider_extras`. Lets Kore and subscribers skip unchanged items. |
| `schema_version` | Version of the `data` shape. `"1"` at launch. |

## 3. Data Model

Illustrative, not prescriptive. Table and column names are the vendor's choice; what is invariant is the set of facts Kore must hold and the contract fields in §6.

| Store | Holds | Notes |
|---|---|---|
| `tenants` | tenant id, display name, hashed subscriber token, active flag | One token per tenant, stored as an HMAC, shown once. |
| `connections` | connection id, tenant, provider, credentials, licensed offices, active flag, last ingest time, last error | Credentials encrypted at rest. `licensed_offices` empty means every office the credential can see. No sync or cursor state (§4). |
| `subscribers` | tenant, bell URL, bell secret, label, active flag, last bell time and status | Several subscribers per tenant. |
| `items` | one row per canonical record | The contract lives here, see below. |
| adapter-owned tables | whatever an adapter needs | Own namespace, own migrations, never read by Kore core (§4). |

The `items` row is the only structure the subscriber contract depends on:

| Field | Purpose |
|---|---|
| `tenant_id`, `connection_id`, `datatype`, `remote_id` | Identity. Primary key. |
| `office_id` | Licensing filter and subscriber-side filtering. Null for tenant-wide datatypes. |
| `seq` | Globally increasing integer, assigned on every content change. The only cursor (§8). |
| `deleted` | Tombstone flag. Tombstones are never purged. |
| `schema_version` | Version of the `data` shape (§6). |
| `content_hash` | Change detection, and the subscriber's skip test. |
| `raw` | The provider's untouched payload. Enables replay (§4) and recompute (§7) without CRM traffic. |
| `data` | The canonical object served to subscribers (§6). |
| `remote_updated_at` | The CRM's own last-change time. The only timestamp subscribers may use for "updated" or sitemap `lastmod`. |
| `rules_version` | Which version of the business rules produced `data`. Lets a recompute target only stale rows (§7). |

One table for all five datatypes. Kore also exposes a read-only health view over connections and subscribers (§11). Migrations are plain SQL files applied in order at startup.

## 4. Adapters and Ingest

### 4.1 The seam

Kore is two parts with one seam between them.

**Kore core** owns storage, the canonical model, business rules and `display`, change detection, tombstone execution, bells and the subscriber API. It knows nothing about any CRM and never names one. A CRM is a `source` string such as `vitec`.

**Adapters** own everything CRM-specific and know nothing about how Kore stores data.

The dependency points one way: an adapter depends on Kore's contracts and canonical types; Kore core never depends on an adapter. Adding a CRM is adding a directory, not editing core.

### 4.2 Where concerns live

| Concern | Owner |
|---|---|
| Authentication, HTTP, endpoints, pagination, rate limits, per-customer quirks | Adapter |
| Webhook receipt, signature validation and parsing | Adapter |
| Deciding when to fetch: scheduling, queues, locking, retries, backoff, last-sync markers | Adapter |
| Knowing what is fresh and what is stale in its CRM | Adapter |
| Translating provider fields to canonical fields | Adapter (mappers) |
| Declaring which datatypes and capabilities the provider supports | Adapter (manifest) |
| Adapter's own persistence and file storage | Adapter, in its own namespace |
| Persistence of raw and canonical records, relationships, change detection, `seq` | Kore core |
| Business rules, `display`, hashing, tombstone execution, licensing filter | Kore core |
| Bells and the subscriber API | Kore core |

Kore core holds no state about CRM freshness. It has no sync timer, no cursor column and no concept of "since". If a CRM's data is stale, that is the adapter's fault and the adapter's to fix.

### 4.3 Registration

Each adapter directory registers itself on startup: the adapter, its manifest, and one mapper per datatype. Kore core keeps registries and looks entries up by `source`. Nothing in core is edited to add a provider.

The **manifest** declares which datatypes the provider supports and which capabilities it has. Core asks the manifest rather than hardcoding, for example, that one provider has no areas.

An adapter may register its own tables and file storage in its own namespace, with its own migrations. Kore core never reads them.

### 4.4 Inbound flow

1. The adapter decides, by its own schedule or by a webhook it received, that a record needs loading.
2. The adapter fetches the record and hands Kore the untouched provider payload with its `source`, `connection_id`, datatype and remote id. Core invokes adapter code; adapter code never calls into core's storage.
3. Kore core looks up the mapper for that `source` and datatype and calls it. The mapper returns a **CanonicalEntity**. Mapping is a pure translation with no I/O and no side effects.
4. Kore core applies business rules (§7), computes `display`, drops the record if its office is outside `licensed_offices`, hashes, and writes. Both `raw` and `data` are stored.
5. If the hash is unchanged and the tombstone flag is unchanged, there is no write and no new `seq`. Otherwise the row gets a new `seq`.
6. After a write, Kore bells every active subscriber of that tenant. Bells are coalesced per tenant over a few seconds so a burst of webhooks produces one bell.

### 4.5 Deletes

An adapter reports a deletion explicitly, or reports the full set of remote ids it currently sees for a scope. Kore core executes the tombstone in either case. An adapter never writes to Kore's tables.

### 4.6 Failure meaning, not mechanics

Adapters swallow HTTP details and expose neutral outcomes: a definitive not-found, versus a call that failed. Status codes never reach Kore core. The adapter decides what to retry and whether to advance its own markers; core only reports the outcome of a write back to the adapter and reports errors to Sentry.

### 4.7 Replay

Because `raw` is stored and mapping is pure, Kore can re-run the current mapper over stored payloads for any scope without contacting the CRM. This is how a mapping bug is fixed. It is the same mechanism as recompute (§7) and follows the same rules: only records whose hash changes get a new `seq`.

### 4.8 Lifecycle events

Kore core notifies an adapter of administrative events only: a connection was added or removed, offices were added or removed, or an operator requested a resync of a scope. Initial load is one of these events. Everything else is initiated by the adapter itself.

## 5. API

All under `/v1/`. Server-to-server only, no CORS. Subscriber auth: `Authorization: Bearer <tenant token>`.

### `GET /v1/changes` (tenant token)

Query: `datatype` (required), `after` (seq, default 0), `limit` (default and max 1000), `schema_version` (default latest).

Returns items where `tenant_id = token.tenant AND datatype = ? AND seq > after ORDER BY seq LIMIT limit`, tombstones included:

```json
{ "items": [ ...item envelopes... ], "next_after": 48213, "has_more": true }
```

`next_after` is the highest `seq` on the page. Tenant comes from the token; a `tenant_id` parameter is rejected.

### `GET /v1/health` (no auth)

`{ "ok": true, "db": true, "version": "1.2.0" }`

### Admin (header `X-Admin-Secret` equal to env `ADMIN_SECRET`)

| Endpoint | Body | Effect |
|---|---|---|
| `POST /v1/admin/bell` | `{tenant_id, kind}` | Fire a bell now. `kind`: `delta` or `forcerefresh`. |
| `POST /v1/admin/event` | `{connection_id, event, office_ids?}` | Send a lifecycle event to the adapter (§4.8). `event`: `connection_added`, `connection_removed`, `offices_added`, `offices_removed`, `resync`. |
| `POST /v1/admin/replay` | `{connection_id, datatype?}` | Re-run mappers over stored raw payloads (§4.7). No CRM traffic. |
| `POST /v1/admin/recompute` | `{tenant_id? , connection_id?, datatype?}` | Re-run business rules and `display` over stored records (§7). No CRM traffic. |

Tenant, connection and subscriber management is SQL (Appendix C). Token generation is a 5-line script in `scripts/`.

Adapters mount their own webhook endpoints under `/v1/hook/<source>/<connection_id>/`. Kore core does not inspect those requests.

### Bell (Kore to subscriber)

`POST <subscriber.url>`, header `X-Kore-Secret: <secret>`, body `{ "kind": "delta" | "forcerefresh", "tenant_id": "t_acme" }`. Timeout 10 s. Outcome stored in `last_bell_at` / `last_bell_status`. Never retried; the subscriber's scheduled pull is the backstop.

## 6. Data Contract

### Item envelope (what `/v1/changes` returns)

```json
{
  "datatype": "property",
  "connection_id": "vitec-acme",
  "remote_id": "OBJ-19203",
  "office_id": "100",
  "seq": 48213,
  "deleted": false,
  "schema_version": "1",
  "content_hash": "e3b0c442...",
  "remote_updated_at": "2026-09-08T10:02:00Z",
  "data": { }
}
```

### `data` shape

Three parts: canonical raw fields, a `display` object with human-readable strings computed by Kore, and `provider_extras` with provider-only fields. Illustrative, not the schema:

```json
{
  "id": "OBJ-19203",
  "slug": "storgatan-12-lidingo",
  "status": "for_sale",
  "listing_type": "apartment",
  "address": { "street": "Storgatan 12", "city": "Lidingö", "postal_code": "18131" },
  "price": 4950000,
  "living_space": 82,
  "additional_space": 12,
  "rooms": 3,
  "lat": 59.3667, "lng": 18.1333,
  "office_id": "100",
  "area_ids": ["area-77"],
  "agent_ids": ["AG-12"],
  "association_id": "BRF-311",
  "images": [ { "url": "https://cdn.../1.jpg", "sort": 1 } ],
  "viewings": [ { "starts_at": "2026-09-14T13:00:00+02:00", "ends_at": "2026-09-14T13:45:00+02:00" } ],
  "published_at": "2026-09-01T08:00:00Z",
  "sold_at": null,
  "display": {
    "price": "4 950 000 kr",
    "living_space": "82 + 12 m²",
    "rooms": "3 rum",
    "address": "Storgatan 12, Lidingö"
  },
  "provider_extras": { "vitec": { "tenureFormCode": 3 } }
}
```

### Rules

1. **JSON Schema per datatype per version** lives in `schemas/<datatype>.v1.json` in the Kore repo and is the source of truth, not this document. All five v1 schemas are committed before the first adapter is merged.
2. **Additive changes do not bump the version.** New fields anywhere, including `display.*`, may appear at any time. Subscribers store `data` verbatim and ignore fields they do not know.
3. **Breaking changes bump `schema_version`:** renaming, removing or retyping a field, or changing an enum's meaning. Kore keeps one canonical model and serves older versions through one down-converter function per old version. An old version is served for at least 90 days after the new one ships. While all subscribers are operated by Kowboy, Kowboy upgrades the clients before removing anything.
4. **Provider-only fields go in `provider_extras.<provider>`**, never at top level. They are excluded from `content_hash`.
5. **Enums are closed sets** defined in the schema. `status`: `coming_soon | for_sale | sold | withdrawn`. `listing_type`: `apartment | house | townhouse | plot | commercial | other`. Unknown CRM values map to `other` and the raw value goes to `provider_extras`. Kore is the only place mapping happens.
6. **Images** are URLs to the CRM's CDN with a sort order. Kore does not host or resize images.
7. **`slug`** is a URL-safe, ASCII-folded string derived by Kore from address and city. Not unique, not stable; routing uses `id`.
8. **Geo:** `lat`/`lng` on property and office; `polygon` (GeoJSON) on area. Plain numbers and JSON.
9. **References** are by id (`office_id`, `agent_ids`, `area_ids`, `association_id`). On first sync subscribers pull `office` and `agent` before `property`; after that, order is irrelevant.

## 7. Business Rules and Helpers

The edge-case ledger supplied by Kowboy becomes `rules/` in Kore: one function per rule, each with its own fixture test, applied after the adapter returns and before hashing. The ledger is authoritative; this table shows the placement principle:

| Rule | Where | Why |
|---|---|---|
| Normalize status, listing type, tenure to enums | Kore | Same answer on every subscriber |
| Merge living and additional space into `display.living_space` | Kore | Formatted once, tested once |
| Price, phone number, address line formatting | Kore, `display.*` | Same |
| Sort images, drop images without URL | Kore | Data cleanup |
| Filter to licensed offices | Kore (write path) | Licensing enforced before data leaves Kore |
| Hide viewings in the past | Subscriber | Depends on current time; would go stale between syncs |
| Route `/objekt/<anything>-<id>` to the property by id | Subscriber | Routing; `slug` is provided for building the URL |
| Truncation, line breaks, per-site wording | Subscriber | Layout and site preference |

**Placement rule:** if the answer depends only on CRM data, Kore computes it. If it depends on the current time, the viewer, or site configuration, the subscriber computes it from raw fields the contract carries. Subscribers may override a `display.*` value but never re-derive it from CRM logic.

### 7.1 Patching derived data without refetching (required)

Rules are a pure function of the stored payload, so any derived value must be fixable without contacting a CRM and without resetting anything.

- `POST /v1/admin/recompute` re-runs the current mappers and rules over stored records for a tenant, connection or datatype, rewrites `data` including `display`, and recomputes the hash. No CRM traffic.
- Only records whose hash actually changed get a new `seq` and reach subscribers. Unchanged records are untouched.
- Records carry the `rules_version` that produced them, so a recompute can target only stale records and an operator can tell which version a record reflects.
- Recompute never alters `raw`, `remote_id`, `remote_updated_at` or any CRM-sourced value. It is not a resync and cannot lose data.
- **Timestamp rule:** a recompute deliberately bumps `seq`, which is how subscribers learn to re-render. No operational or SEO logic anywhere may key on a local write time. Subscribers derive "updated" dates and sitemap `lastmod` from `remote_updated_at` only.

## 8. Subscriber Sync Contract

What every subscriber MUST implement. Around 150 lines in any language.

### State

- `after` per datatype (integer, initial 0).
- `content_hash` per stored item.

### Loop

```
for datatype in [office, agent, area, association, property]:
  loop:
    page = GET /v1/changes?datatype=D&after=A&limit=1000
    for item in page.items:
      if item.deleted:                        delete local(connection_id, remote_id); forget hash
      elif stored_hash(item) == item.content_hash: skip
      else:                                   upsert local from item.data; store hash
    A = page.next_after; persist A            # same transaction as the writes
    if not page.has_more: break
```

`seq` is assigned under a mutex at commit time and never reused, so no item with a lower `seq` can appear after a higher one was read. Advancing after every page is therefore safe, no overlap is needed, and a delta from any cursor yields exactly the items changed since. Tombstones travel through the same query.

### Triggers

- Bell `delta`: run the loop.
- Bell `forcerefresh`: forget all stored hashes, set every `after = 0`, run the loop. Every item is rewritten. Used after template or mapping changes.
- Scheduled: run the loop every 15 min regardless of bells (backstop for lost bells; a no-op when nothing changed).
- First install or local data loss: `after = 0`, run the loop.

### Concurrency

One sync at a time per subscriber. A bell arriving during a run sets a "run again" flag; `forcerefresh` outranks `delta`. After the run, run once more if the flag is set.

### Resilience (non-negotiable)

- Page rendering reads only from the local store.
- A malformed or unknown item is logged to Sentry and skipped; the loop continues.
- Unknown fields are stored verbatim and ignored by templates.
- The subscriber shows "last successful sync" where an operator can see it.

### Safe update (non-negotiable)

The code that updates the subscriber must not depend on the code it updates. The updater is a separate minimal component (WordPress: a must-use plugin under 50 lines; Lovable: a separately deployed edge function) with no dependency on sync or template code. A broken release must always be replaceable by the next release.

## 9. Search and Rendering Semantics

Search runs in the subscriber against its local store. The contract fixes meaning so both subscribers give the same answer:

- Filters: `status`, `listing_type`, `office_id`, `area_ids` (any), `price` min/max, `rooms` min/max, `living_space` min/max, bounding box on `lat`/`lng`.
- Sort keys: `published_at` desc (default), `price` asc/desc, `sold_at` desc.
- "Till salu" means `status in (coming_soon, for_sale)`. "Referenser" means `status = sold`. `withdrawn` is never listed.
- Polygon search (point in `area.polygon`) is optional per subscriber. WordPress: MySQL `ST_Contains`. Lovable: Supabase PostGIS.
- Sitemaps, canonical URLs and pagination are subscriber-native features.

## 10. Authentication

| Credential | Held by | Grants |
|---|---|---|
| Tenant token (32 random bytes, base64url) | The tenant's subscribers | `/v1/changes` for that tenant |
| `ADMIN_SECRET` (env) | Kowboy | `/v1/admin/*` |
| Subscriber secret | Kore, and the subscriber | Lets the subscriber verify bells |

Tokens stored as `HMAC-SHA256(pepper, token)` with the pepper in env; shown once. Rotation: generate, update consumer, replace column. Revocation: `is_active = false`.

## 11. Operations

- Hosting: one container plus one managed Postgres with daily snapshots. One staging, one production.
- Env: `DATABASE_URL`, `ADMIN_SECRET`, `TOKEN_PEPPER`, `SENTRY_DSN`. Nothing else.
- Sentry is the only error surface, wired into Kore, adapters and both subscribers.
- Health: `/v1/health` for an uptime monitor. The health view answers "is sync working" and "is the site reachable".
- Recovery from DB loss: restore snapshot, start Kore, then `POST /v1/admin/event {event: "resync"}` per connection. Subscribers converge on their next pull.
- No dashboards, no metrics pipeline, no logs beyond stdout and Sentry.

## 12. Agent Build Kit

The repository contains, before any feature code, what an agent needs to build and verify without a human in the loop:

```
schemas/<datatype>.v1.json                    five JSON Schemas
fixtures/<provider>/<datatype>/*.json         real, anonymized CRM payloads
expected/<datatype>/*.json                    the canonical item each fixture must produce, display.* included
rules/<rule>.ts + rules/<rule>.test.ts        one business rule per file, from the supplied ledger
fixtures/sync/*.json                          seq / cursor / tombstone / forcerefresh scenarios
test/adapter/                                 a fake adapter proving core needs no CRM knowledge (§4)
test/contract/                                a fake subscriber running §8 against Kore, asserting convergence
README.md                                     under one page: run, test, deploy, add a tenant
```

Definition of done for any change: all fixture and contract tests pass. No manual verification step may be required.

## 13. Acceptance Criteria

1. Each fixture produces its expected canonical item byte-for-byte, `display.*` included.
2. An unchanged CRM record on re-pull produces no new `seq` and no bell.
3. A changed record produces exactly one new `seq`; a record the adapter reports as gone becomes a tombstone with a new `seq`.
4. `/v1/changes` from `after = 0` returns every live item and every tombstone in `seq` order; from any later `after`, exactly the items changed since.
5. Fake subscriber started at `after = 0` converges to Kore's state; started later, it converges from its cursor; after `forcerefresh` every item is rewritten.
6. Two connections of the same provider under one tenant do not collide.
7. A tenant token cannot read another tenant; the admin secret is required for admin.
8. Kore stopped: the WordPress and Lovable reference sites keep serving pages.
9. `licensed_offices` set to one office: only that office's items exist in Kore.
10. A field added to a schema without a version bump reaches subscribers and breaks nothing.
11. A malformed CRM record is reported to Sentry, skipped, and does not block the adapter's run.
12. A fake adapter with an invented provider works end to end without any change to Kore core, and no CRM name appears anywhere in core.
13. Changing a `display` rule and calling `recompute` rewrites the affected records, bumps only their `seq`, causes no CRM traffic, and leaves `remote_updated_at` unchanged.
14. Adding an office to an existing connection loads only that office's records.
15. `replay` over stored payloads reproduces the current canonical records exactly.

## Appendix A - WordPress Reference Client (in scope for this quotation)

- Settings: Kore URL, tenant token, bell secret. Nothing else.
- Storage: one CPT per datatype as carrier (native sitemap, permalinks, SEO plugins, cache purge). Full `data` in one JSON meta key. A small index table `kore_index(post_id, datatype, remote_id, connection_id, status, listing_type, office_id, price, rooms, living_space, lat, lng, published_at, sold_at, content_hash)` for archives, search and dedupe. Not one meta key per field.
- Bell endpoint `POST /wp-json/kore/v1/bell`: validates `X-Kore-Secret`, returns 202, schedules the sync via Action Scheduler. Backstop: WP-Cron every 15 min.
- On write: `wp_update_post`, `clean_post_cache`, `do_action('kore_item_updated', $post_id)` for cache plugins. Tombstone: delete post.
- Templates: `single-<datatype>.php` and archive templates ship with the plugin, render from `display.*` plus raw fields via template tags; themes override by copying the file. No data logic in templates.
- Routing: `/objekt/{slug}-{id}` resolves by id; canonical URL uses the current slug. Past viewings hidden at render time.
- Geo: `lat/lng BETWEEN` for bounding box; MySQL `ST_Contains` for polygon if wanted.
- Updater: must-use plugin that checks Kowboy's update endpoint and swaps the plugin directory. Never touched by feature releases.
- WP-CLI: `wp kore sync`, `wp kore sync --force`, `wp kore status`.
- Forbidden in this repo: the strings `vitec`, `mspecs`, any CRM field name.

## Appendix B - Lovable Reference Client (in scope for this quotation)

A reference implementation of §8 for a Lovable project (React front end on Supabase), plus a minimal example site proving it end to end. It is the template every future Lovable broker site starts from.

- Configuration: Kore URL, tenant token, bell secret, held as Supabase secrets. Nothing else.
- Storage: Supabase tables `properties`, `agents`, `offices`, `areas`, `associations`, keyed by `(connection_id, remote_id)`. Full `data` as JSONB plus indexed columns for the §9 filters. `kore_sync_state(datatype, after)` holds the cursor, and the item hash is stored per row.
- Sync: one Supabase edge function implementing §8 exactly, triggered by the bell route and by a scheduled run every 15 minutes as backstop. Handles `delta` and `forcerefresh`, tombstones, and the one-sync-at-a-time rule.
- Bell route: a Supabase edge function validating `X-Kore-Secret`, returning 202, and queuing the sync.
- Site: reads only from Supabase, never from Kore. `display.*` used directly in components. Search and filtering via PostgREST against the indexed columns; polygon search via Supabase's PostGIS. Past viewings hidden at render time; `lastmod` and any "updated" date derived from `remote_updated_at`.
- Example site: listing archive with the §9 filters and sorts, single property page, agent list, sold references. Deliberately plain; visual design is Kowboy's per customer.
- Safe update: the sync and bell functions are deployed and versioned separately from the site, and site code cannot modify them. A broken site release must never break syncing (§8).
- Onboarding: one prompt that points a Lovable project at the client README and supplies Kore URL, token and secret. The prompt never describes endpoints or the API; the README carries that.
- Forbidden in this repo: the strings `vitec`, `mspecs`, any CRM field name.

## Appendix C - Operator Runbook (SQL and curl)

```sql
-- new tenant (token from scripts/token.ts, store the HMAC it prints)
INSERT INTO tenants (tenant_id, display_name, token_hmac) VALUES ('t_acme', 'Acme Mäkleri', '<hmac>');

-- new connection
INSERT INTO connections (connection_id, tenant_id, provider, credentials)
VALUES ('vitec-acme', 't_acme', 'vitec', '{"customerId":"...","apiKey":"..."}');

-- new subscriber
INSERT INTO subscribers (tenant_id, url, secret, label)
VALUES ('t_acme', 'https://acme.se/wp-json/kore/v1/bell', '<random>', 'production');

-- health
SELECT * FROM health_view;
```

```
# initial load after adding a connection
curl -X POST $KORE/v1/admin/event -H "X-Admin-Secret: $S" -d '{"connection_id":"vitec-acme","event":"connection_added"}'
# load a newly licensed office only
curl -X POST $KORE/v1/admin/event -H "X-Admin-Secret: $S" -d '{"connection_id":"vitec-acme","event":"offices_added","office_ids":["205"]}'
# fix a display or mapping bug, no CRM traffic
curl -X POST $KORE/v1/admin/recompute -H "X-Admin-Secret: $S" -d '{"connection_id":"vitec-acme"}'
# force every subscriber to rewrite everything after a template change
curl -X POST $KORE/v1/admin/bell -H "X-Admin-Secret: $S" -d '{"tenant_id":"t_acme","kind":"forcerefresh"}'
```

Offboarding: `UPDATE tenants SET is_active = false; UPDATE connections SET is_active = false; UPDATE subscribers SET is_active = false` for the tenant. Data is retained.
