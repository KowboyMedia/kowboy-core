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
cp .env.example .env          # set DATABASE_URL, ADMIN_SECRET, CREDENTIALS_KEY
npm run build
npm run start:web             # subscriber API, admin, health, adapter endpoints
npm run start:worker          # adapter background work, bells, housekeeping
```

Migrations run at startup, so `npm run migrate` is only needed to apply them on their own.

## Checking it

```bash
npm run check                 # what CI blocks on: typecheck, the seam, nothing invented,
                              # no skipped tests, no committed secrets, build, tests
npm run lint                  # warnings, which never block
npm run report                # regenerate acceptance/report.md from a test run
```

Tests need a database. `DATABASE_URL` defaults to `postgres://core:core@127.0.0.1:5432/core`.

## Layout

```
main.ts               entrypoint: starts the engine, mounts adapter endpoints, starts adapters
engine/               CRM-agnostic: storage, rules, bells, subscriber API, recompute, health, events
engine/adapter-api/   the only engine code adapters may import (protected)
adapters/<provider>/  everything CRM-specific, one folder per CRM
schemas/              JSON Schema per datatype (protected)
golden/fake/          dummy golden masters for the fake adapters
acceptance/           criteria mapped to named tests, plus the generated report (protected)
docs/                 strategy, decisions, open questions, inputs
```

The seam is enforced by CI: no CRM name appears in `engine/`, adapters import only
`engine/adapter-api/`, and `main.ts` is the only file that imports both sides.

So is provenance: every field in `schemas/` cites the human-written document it came from, and
every rule in `engine/rules/` cites its `rules-ledger/` entry. The data model is not defined yet -
[docs/field-tables.md](docs/field-tables.md) says what is missing and what defining it takes.
