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
cp .env.example .env          # set DATABASE_URL, ADMIN_SECRET, ADMIN_EMAIL_DOMAINS, CREDENTIALS_KEY
npm run build
npm run start:web             # subscriber API, admin, health, adapter endpoints
npm run start:worker          # adapter background work, bells, housekeeping
```

Migrations run at startup. The admin panel is at `/admin` on the web process: log in with a link
mailed to an address at an allowed domain (`ADMIN_EMAIL_DOMAINS`; the mail needs `MAIL_FROM` and
`POSTMARK_SERVER_TOKEN`), then tenants, sites, connections, the adapters' own panels, items,
events, a test panel and settings ([docs/admin-panel.md](docs/admin-panel.md)).

Tenants, connections and subscribers are also added with one script, through the same functions
the panel uses, so tokens are hashed and CRM credentials encrypted the way the engine expects:

```bash
node dist/scripts/tenant.js add-tenant t_acme "Acme Mäkleri"        # prints the tenant token once
node dist/scripts/tenant.js add-connection acme-1 t_acme <provider> '<credentials>' 100,205
node dist/scripts/tenant.js add-subscriber t_acme "acme.se" https://acme.se/wp-json/core/v1/bell
```

The Vitec adapter's connection format, webhook URL and settings (`VITEC_WEBHOOK_TOKEN`,
`VITEC_FETCH_CONCURRENCY`) are in [adapters/vitec/README.md](adapters/vitec/README.md).

## Deploying

Core runs on DigitalOcean App Platform with one managed Postgres cluster in Frankfurt (strategy
§2). Two apps share it, each with a database of its own:

| App                   | Spec                   | Branch    | Deploys                              | Database       |
| --------------------- | ---------------------- | --------- | ------------------------------------ | -------------- |
| `kowboy-core-staging` | `.do/app.staging.yaml` | `staging` | on every push                        | `core_staging` |
| `kowboy-core`         | `.do/app.yaml`         | `main`    | when an agent asks, on Patric's word | `defaultdb`    |

A change, from an agent or a human, goes: pull request → the checks must pass → merge into
`staging` → staging updates itself → confirm on staging → pull request into `main` → the checks
again → merge → production updates itself, health-gated, keeping the old version live if the new
one fails. GitHub's branch protection (below) makes the checks the only way in, for everyone. An
agent merges on Patric's word, a dev with the merge button. `.github/workflows/deploy.yml` is a
manual button that deploys `main` again without a merge, for a retry. Each app is a `web`
service with its readiness probe on `/v1/ready` and a `worker`; the cluster is bound as
`DATABASE_URL` with its CA as `DATABASE_CA_CERT`, which `scripts/start.sh` hands to Node. A spec
is changed by editing it and updating the app through the API; what DigitalOcean returns is
committed back, secrets encrypted. Vitec is given each app's notification URL,
`https://<app domain>/v1/hook/vitec/webhook/<that app's VITEC_WEBHOOK_TOKEN>`.

**One gate for everyone (branch protection, one-time, by a repository admin):** GitHub → this
repository → Settings → Rules → Rulesets → New ruleset → New branch ruleset. Name it
`checks before merge`, set Enforcement to Active, add `main` and `staging` under Target branches,
tick Restrict deletions, Require a pull request before merging, Require status checks to pass
(add `Enforced checks (block merge)` and `WordPress client tests (block merge)`) and Block force
pushes, then Create. From then on nobody, agent or human, gets code into `staging` or `main`
except through a pull request with green checks.

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
