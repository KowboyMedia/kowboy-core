# Field tables

**The entire CRM payload reaches the sites: raw, unified and display (Patric, 2026-09-18).**
`raw` is the payload as received. `data` (unified) mirrors the whole payload mechanically, every
field under its snake_case name with the CRM's nesting kept, the spine on top, plus `display` and
`provider_extras`; [data-model-reference.md](data-model-reference.md) lists every path. The
plugin's own field names, once supplied, are laid on top as renames. `display` stays empty until
the rules ledger exists.

An earlier version of this file listed a full model: addresses, prices, living space, rooms, phone
numbers, agent portraits. None of it came from a CRM. It was assembled from the SRS's data-contract
example, which the SRS itself labels _illustrative, not the schema_, and from what an agent
supposed a Swedish brokerage site shows. That is a guess, and a guess in the contract is worse than
a gap: it gets built on, tested against and believed. It has been removed.

What remains in `schemas/` is the structural spine, and the tables below say where each field
comes from. `schemas/` is a protected path: nothing is added to it without approval.

## What is defined

### Envelope (`schemas/item.v1.json`)

The envelope is machinery, not description: the cursor, identity, the tombstone flag, the hash and
the licensing filter. It comes from SRS §3 and §6 and is unchanged.

| Field                                    | Source                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `datatype`, `connection_id`, `remote_id` | SRS §3, item identity                                                            |
| `office_id`                              | SRS §3, licensing filter; null for tenant-wide datatypes                         |
| `seq`                                    | SRS §3, the only cursor                                                          |
| `deleted`                                | SRS §3, tombstone flag                                                           |
| `schema_version`                         | SRS §6                                                                           |
| `content_hash`                           | SRS §3, change detection and the subscriber's skip test                          |
| `remote_updated_at`                      | SRS §3, the CRM's own last-change time                                           |
| `raw`                                    | The CRM payload as received, untouched; null on a tombstone (Patric, 2026-09-18) |
| `data`                                   | SRS §6, the unified object: the payload mirrored mechanically, the spine on top  |

### `data`, every datatype

| Field             | Source                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `id`              | SRS §6.9, references are by id                                                                                  |
| `display`         | SRS §6 strings, the engine from `universal` by ledger entries; empty until one exists (question 44, 2026-09-19) |
| `provider_extras` | SRS §6.4, provider-only fields, excluded from `content_hash`                                                    |

### `data`, property only

| Field                                                  | Source                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `office_id`, `agent_ids`, `area_ids`, `association_id` | SRS §6.9, references are by id                                                         |
| `project_id`                                           | The project a property belongs to (project approved as the sixth datatype, 2026-09-16) |

### `data`, agent only

| Field        | Source                                                          |
| ------------ | --------------------------------------------------------------- |
| `office_ids` | An agent belongs to one or several offices (Patric, 2026-09-16) |

### `data`, project only

| Field                                | Source                                         |
| ------------------------------------ | ---------------------------------------------- |
| `office_id`, `agent_ids`, `area_ids` | As property; a project has the same references |

That is the whole contract today. The schemas set `additionalProperties: true` and say
`INCOMPLETE` in their description, so nothing pretends this is finished.

## What is missing, and what it takes to define it

The descriptive model - what a property, office, agent, area, association and project actually hold - is
added **in one piece**, not field by field as guesses accumulate. Defining it needs three things,
none of which an agent can supply:

1. **The CRM data models.** Vitec Connect's advertising endpoints and its full (not default
   limited) datamodel are read (`docs/inputs/vitec/`, fetched 2026-09-16) and the proposal is
   traced to them. Mspecs is not documented yet.
2. **The parity inventory** (strategy §9, Phase 5): what the current sites actually show, so the
   model covers the real use rather than the CRM's whole surface.
3. **The rules ledger** for anything derived rather than copied, including every `display.*` string.

Statements the SRS makes that will feed that work, once there is a data model to apply them to:
closed enums for `status` and `listing_type` (§6.5), images as CDN URLs with a sort order (§6.6),
`lat`/`lng` on property and office and a GeoJSON `polygon` on area (§6.8); `slug` (§6.7) is
superseded, the site sets its slugs (strategy §12.23). These are recorded here rather than implemented, because the SRS
describes how a field behaves without establishing that the CRM supplies it.

## What this costs right now

Nothing structural. The engine does not read contract fields: identity, hashing, `seq`, tombstones,
the licensed-office filter, bells, the cursor, recompute and the event log all work on whatever
`data` holds. The fake adapters carry `fake_*` fields so change detection has something to detect,
and those names are deliberately impossible to mistake for the contract.

When the model lands, it lands as an additive change (SRS §6 rule 2): new fields do not bump
`schema_version`, so nothing here blocks the clients or the adapters being built first.
