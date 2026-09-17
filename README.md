# Kowboy Core

Kowboy Core is the central service that reads real estate CRMs, normalizes their data into one
model and serves it to thin website clients.

- Plan: [docs/strategy.md](docs/strategy.md) · Agent instructions: [AGENTS.md](AGENTS.md)
- Decisions: [docs/decisions.md](docs/decisions.md) · Open questions: [docs/open-questions.md](docs/open-questions.md)
- Contract: [schemas/](schemas/) and [docs/field-tables.md](docs/field-tables.md)
- Acceptance: [acceptance/report.md](acceptance/report.md)

## Running it

Needs Node 22 and a Postgres 16 database.

```bash
npm install
export DATABASE_URL=… ADMIN_SECRET=… CREDENTIALS_KEY=…   # the key: openssl rand -base64 32
npm run build
npm run start:web             # subscriber API, admin, health, adapter endpoints
npm run start:worker          # adapter background work, bells, housekeeping
```

Migrations run at startup.

Tenants, connections and subscribers are added with one script, so tokens are hashed and CRM
credentials encrypted the way the engine expects:

```bash
node dist/scripts/tenant.js add-tenant t_acme "Acme Mäkleri"        # prints the tenant token once
node dist/scripts/tenant.js add-connection acme-1 t_acme <provider> '<credentials>' 100,205
node dist/scripts/tenant.js add-subscriber t_acme "acme.se" https://acme.se/wp-json/core/v1/bell
```

The Vitec adapter's connection format, webhook URL and settings (`VITEC_WEBHOOK_TOKEN`,
`VITEC_FETCH_CONCURRENCY`) are in [adapters/vitec/README.md](adapters/vitec/README.md).

## Deploying

Core runs on DigitalOcean App Platform with a managed Postgres cluster in the same EU region,
Frankfurt (strategy §2). [`.do/app.yaml`](.do/app.yaml) is the app: a `web` service with its
readiness probe on `/v1/ready`, a `worker`, the cluster bound as `DATABASE_URL` and its CA as
`DATABASE_CA_CERT`, which the app verifies the cluster against. An agent creates it once
`DIGITALOCEAN_ACCESS_TOKEN` is in the environment, generating the three secrets itself
(docs/next-steps.md item 6):

1. Create the managed Postgres cluster in the region of the spec, named as its `cluster_name`,
   with a database `core` and a user `core`.
2. Copy `.do/app.yaml` to `.do/app.local.yaml` (ignored by git), fill in the three secrets
   (`ADMIN_SECRET`, `CREDENTIALS_KEY` as 32 random bytes in base64, `VITEC_WEBHOOK_TOKEN`) and run
   `doctl apps create --spec .do/app.local.yaml`.
3. Commit back what DigitalOcean returns, secrets encrypted:
   `doctl apps spec get <app-id> > .do/app.yaml`.

Later changes are edits to `.do/app.yaml` followed by `doctl apps update <app-id> --spec
.do/app.yaml`. Production never deploys on push, because a human approves each release
(strategy §4); staging is the same spec with another name, `deploy_on_push: true` and its own
cluster. Vitec is given the webhook URL `https://<app domain>/v1/hook/vitec/webhook/<token>`.

**Restoring the database:** restore it in DigitalOcean, restart the app, nothing else (strategy
§7.2). `/v1/health` stays red until every adapter has caught up; send no `forcerefresh` to a site
while it is red. The platform's own probe is `/v1/ready`, which only asks whether the process can
serve, so a deploy is never held up by a site or an adapter.

## Checking it

```bash
npm run check                 # what CI blocks on: typecheck, the seam, no skipped tests,
                              #, no committed secrets, build, tests
npm run test:wordpress        # the WordPress client suite; needs clients/wordpress/test/setup.sh once
npm run lint                  # warnings, which never block
npm run report                # regenerate acceptance/report.md from a test run
```

Tests need a database. `DATABASE_URL` defaults to `postgres://core:core@127.0.0.1:5432/core`. The
Lovable client suite is part of `npm test` and runs its function under Deno, installed from npm.

## Layout

```
main.ts               entrypoint: starts the engine, mounts adapter endpoints, starts adapters
engine/               CRM-agnostic: storage, rules, bells, subscriber API, recompute, health, events
engine/adapter-api/   the only engine code adapters may import (protected)
adapters/<provider>/  everything CRM-specific, one folder per CRM: vitec, and two fakes
clients/wordpress/    thin WordPress client: the sync loop, bell endpoint and store
clients/lovable-kit/  one Supabase function and migrations every Lovable site starts from
schemas/              JSON Schema per datatype (protected)
golden/fake/          dummy golden masters for the fake adapters
acceptance/           criteria mapped to named tests, plus the generated report (protected)
docs/                 strategy, decisions, open questions, inputs
```

The seam is enforced by CI: no CRM name appears in `engine/`, adapters import only
`engine/adapter-api/`, and `main.ts` is the only file that imports both sides.

The data model is not defined yet: [docs/field-tables.md](docs/field-tables.md) says what is missing
and what defining it takes.
