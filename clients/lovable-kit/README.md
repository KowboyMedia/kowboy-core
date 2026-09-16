# Lovable kit

Everything a Lovable site needs to hold a copy of its Kowboy Core data and keep it current: one
Supabase edge function and two migrations. The site itself reads only from its own Supabase tables,
never from Core, so Core being down means stale data and never a broken site (Concept).

This is the subscriber contract (SRS §8) for Supabase. Every future Lovable broker site starts from
it. The visual side of the site is not here: no components, no pages, no search, because the data
model is not defined yet (`docs/field-tables.md`).

## What is in it

```
supabase/functions/core-sync/index.ts   the bell endpoint and the sync loop, one function
supabase/functions/core-sync/deno.json  its one dependency (a Postgres driver)
supabase/migrations/0001_core_client.sql   the tables: one per datatype, plus the sync's state
supabase/migrations/0002_core_backstop.sql the 15 minute schedule (pg_cron + pg_net, secrets from Vault)
supabase/config.toml                    the section that lets Core call the function without a JWT
```

**How it works.** Core POSTs a bell to the function with `X-Core-Secret`. The function answers 202
at once and then pulls `GET /v1/changes?datatype=…&after=<cursor>` page by page, for offices,
agents, areas, associations, projects and properties in that order. Each page and its cursor commit together.
A tombstone deletes the row; an item whose `content_hash` is already stored is skipped; anything
else is upserted with its `data` stored verbatim. `forcerefresh` pulls everything from 0 and
rewrites every row; a `409 resync_required` from Core does the same and then deletes rows that were
not seen, only after every page succeeded, so the site is never emptied.

One sync runs at a time per site (a Postgres advisory lock). A bell arriving during a run leaves a
note that the running sync works through before it finishes, so nothing is lost and no two runs
overlap. Supabase stops an invocation after a few minutes, so one works for at most a minute and
then calls the function again to carry on where the cursors are: one bell finishes any sync,
however large, without a second trigger from outside. The schedule in `0002` runs a sync every 15
minutes whether or not a bell arrived.

## Installing it in a Lovable project

1. Copy `supabase/functions/core-sync/` and `supabase/migrations/` into the project, and add the
   `[functions.core-sync]` section from `supabase/config.toml` to the project's own `config.toml`.
2. Set the three secrets. Kowboy hands them over per site; nothing else is configurable.

   ```bash
   supabase secrets set CORE_URL=https://core.example CORE_TENANT_TOKEN=… CORE_BELL_SECRET=…
   ```

   `SUPABASE_DB_URL` and `SUPABASE_URL` are provided by Supabase itself. The database URL must be
   the direct (session) connection, which is what Supabase injects; a transaction-mode pooler
   cannot hold the lock. `SUPABASE_URL` is how the function calls itself to carry on a long sync.

3. Deploy and migrate:

   ```bash
   supabase functions deploy core-sync --no-verify-jwt
   supabase db push
   ```

   Before `db push`, create the two Vault secrets the backstop reads, as described at the top of
   `0002_core_backstop.sql`.

4. Give Kowboy the bell URL, `https://<project-ref>.supabase.co/functions/v1/core-sync`, so Core
   can register the site as a subscriber.

The first sync happens on the first bell or the first scheduled run. To start one by hand:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/core-sync \
  -H 'X-Core-Secret: <bell secret>' -H 'content-type: application/json' -d '{"kind":"delta"}'
```

## Reading the data from the site

- Tables `properties`, `agents`, `offices`, `areas` and `associations`, keyed by
  `(connection_id, remote_id)`. Read through PostgREST as usual; they are readable by `anon` and
  writable by nobody but the function.
- `data` is the item exactly as Core served it. `data.display.*` are the strings to show. References
  between items are ids: `data.office_id`, `data.agent_ids`, `data.area_ids`, `data.association_id`.
- `remote_updated_at` is the only timestamp for "updated" or sitemap `lastmod`. `synced_at` and
  `seq` are the sync's own bookkeeping; never show them and never sort by them.
- `core_sync_state` holds the cursors and, for the operator, `last_success_at`, `last_error` and
  `running_since`. Show `last_success_at` somewhere an operator can see it.
- Unknown fields in `data` may appear at any time. Store them, ignore them.

## Rules

- The site never calls Core. Everything comes from these tables.
- Site code never edits the function or the migrations. They are deployed and versioned on their
  own, so a broken site release cannot stop syncing.
- Anything computed from CRM data is Core's job; the site formats nothing itself beyond what depends
  on the current time or the viewer, such as hiding past viewings.

## The onboarding prompt

> This project is a Kowboy Core site. Follow `clients/lovable-kit/README.md` from the Kowboy Core
> repository to install the sync function and migrations, with these values: Core URL `…`, tenant
> token `…`, bell secret `…`. Then build the pages from the Supabase tables it describes.
