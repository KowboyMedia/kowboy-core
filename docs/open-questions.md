# Open questions

Everything an agent could not settle from the Concept, the SRS, the strategy or the rules ledger.
Each one names what is blocked and what the smaller option would be, so answering is quick.
Answered questions move to `decisions.md` and are deleted from here.

## 1. Gate 2: the field tables

`docs/field-tables.md` is the approval item. The schemas contain **only** fields the SRS data
contract names. The "Proposed" table at the end lists what broker sites usually show
(`description`, `monthly_fee`, `build_year`, `energy_class`, …). Nothing was invented into the
contract. Approve the ones we need and they are added additively.

## 2. Protected paths created by an agent

`schemas/`, `acceptance/` and `golden/fake/` did not exist before. CODEOWNERS now protects the
first two, so this is the one time they are created without a prior review. They need your read.

## 3. A second runtime dependency: `ajv`

Runtime dependencies are `pg` and `ajv` (with `ajv-formats`). `pg` is implied by the Postgres
decision. `ajv` validates a canonical record against its schema **on the write path**, so a record
that does not match the contract never reaches a subscriber (AC 11, AC 23), and it backs the
release impact preview. The alternative is hand-written validation, which would duplicate the
schemas. Approve, or say validation should be test-time only.

## 4. Where an adapter keeps its own tables

The strategy says an adapter owns its queue, dedupe and retries "in its own tables", and that
adapters know nothing about engine storage. The adapter API offers no database handle, so a real
adapter would open its own connection pool to the same Postgres. The fake adapters keep their
fetch list in memory, so nothing was decided by accident. Two options when Vitec is built:

- **a.** The adapter opens its own pool from `DATABASE_URL` and owns its migrations. No change to
  the adapter API.
- **b.** The adapter API gains a scoped SQL handle for adapter-owned tables. That is an adapter API
  change, which needs approval.

Option a is smaller and needs no approval, so that is the default unless you say otherwise.

## 5. Rules that the SRS names but does not define

Implemented today: `slug`, `display.price`, `display.living_space`, `display.rooms`,
`display.address`, image cleanup. Each one is spelled out by the SRS data contract.

Not implemented, because inventing them is forbidden and `rules-ledger/` is empty:

- **Phone formatting.** SRS §7 places it in Core but gives no format. `display.phone` is not
  produced at all today.
- **Price on request.** When the CRM has no price, `display.price` is left out. What should a site
  show instead?
- **Unknown `status` values.** An unknown `listing_type` becomes `other` (SRS §6.5 says so), but
  `status` has no such rule, so an unknown status is treated as a malformed record and dropped with
  an event. Confirm that is right.

## 6. Images

Kowboy serves images through a separate CDN app, so the Vitec adapter is expected to leave `images`
and `agent.image_url` empty. The fields stay in the contract because the SRS defines them. Confirm,
or say they should go.

## 7. Vitec Connect documentation is unreachable from this environment

`vitec.net` and `connect.maklare.vitec.net` are blocked by the environment's network egress policy
(403 on CONNECT). No Vitec work was attempted, and nothing about Vitec's endpoints was guessed.
To unblock the adapter, either allow those domains for this environment, or paste the relevant
documentation into `docs/inputs/` as a human-supplied spec: the marketing endpoints, how to ask for
the full datamodel rather than the default limited one, authentication, installation id,
pagination and rate limits.

## 8. Phase 1 cannot exit without the platform

Phase 1's exit is a real PR → staging → production deploy, and AC 18, 24, 27 need a live
environment. The app is built to run on DigitalOcean App Platform with managed Postgres, but
nothing is deployed. Phase 1 is split in the strategy into Foundation (done) and Deploy (waiting
on you).
