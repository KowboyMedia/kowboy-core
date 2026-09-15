# Field tables (Gate 2)

One table per datatype. **This is the Gate 2 approval item** (strategy §9). The schemas in
`schemas/` are the source of truth for shape; this document says what each field means and where
it comes from.

**v1 contains only fields the SRS data contract (§6) names.** Everything else a broker site might
need is listed under "Proposed" at the end and is _not_ in the schema yet. Adding a field later is
additive and does not bump `schema_version` (SRS §6 rule 2), so nothing here blocks the engine.

Conventions: every field is required and explicitly `null` when the CRM has no value. `display.*`
holds human-readable strings computed by Core. `provider_extras.<provider>` holds provider-only
fields and is excluded from `content_hash`.

## Envelope (`schemas/item.v1.json`)

| Field               | Type           | Meaning                                                   |
| ------------------- | -------------- | --------------------------------------------------------- |
| `datatype`          | enum           | `property`, `agent`, `office`, `area`, `association`      |
| `connection_id`     | string         | Which CRM connection produced the item                    |
| `remote_id`         | string         | The CRM's id, untouched                                   |
| `office_id`         | string \| null | Licensing filter; null for tenant-wide datatypes          |
| `seq`               | integer        | Cursor. Strictly increasing per tenant, assigned on write |
| `deleted`           | boolean        | Tombstone. `data` is null when true                       |
| `schema_version`    | string         | `"1"` today                                               |
| `content_hash`      | string         | Hash of `data` excluding `provider_extras`                |
| `remote_updated_at` | string \| null | The CRM's own timestamp, never Core's write time          |
| `data`              | object \| null | The universal model below                                 |

## property

| Field              | Type           | Source  | Notes                                                                                                                                      |
| ------------------ | -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`               | string         | CRM     | Same value as `remote_id`                                                                                                                  |
| `slug`             | string         | Core    | ASCII-folded from address and city. Not unique, not stable (SRS §6.7)                                                                      |
| `status`           | enum           | Core    | `coming_soon \| for_sale \| sold \| withdrawn`. Unknown CRM values are a mapping question, not `other`                                     |
| `listing_type`     | enum           | Core    | `apartment \| house \| townhouse \| plot \| commercial \| other`. Unknown values map to `other`, raw value to `provider_extras` (SRS §6.5) |
| `address`          | object         | CRM     | `street`, `city`, `postal_code`                                                                                                            |
| `price`            | number \| null | CRM     | Asking price in SEK. Null when the CRM has none (price on request is a ledger rule)                                                        |
| `living_space`     | number \| null | CRM     | m²                                                                                                                                         |
| `additional_space` | number \| null | CRM     | m²                                                                                                                                         |
| `rooms`            | number \| null | CRM     | May be a half number (3.5)                                                                                                                 |
| `lat`, `lng`       | number \| null | CRM     | Plain numbers (SRS §6.8)                                                                                                                   |
| `office_id`        | string \| null | CRM     | Reference                                                                                                                                  |
| `area_ids`         | string[]       | CRM     | References                                                                                                                                 |
| `agent_ids`        | string[]       | CRM     | References                                                                                                                                 |
| `association_id`   | string \| null | CRM     | Reference                                                                                                                                  |
| `images`           | array          | CRM     | `{url, sort}`, sorted, entries without a URL dropped (SRS §7). Core never hosts or resizes                                                 |
| `viewings`         | array          | CRM     | `{starts_at, ends_at}`. Past viewings are hidden by the subscriber, not here                                                               |
| `published_at`     | string \| null | CRM     |                                                                                                                                            |
| `sold_at`          | string \| null | CRM     |                                                                                                                                            |
| `display`          | object         | Core    | `price`, `living_space`, `rooms`, `address` today; additive                                                                                |
| `provider_extras`  | object         | Adapter | Keyed by provider                                                                                                                          |

## office

| Field             | Type           | Source  | Notes                                           |
| ----------------- | -------------- | ------- | ----------------------------------------------- |
| `id`              | string         | CRM     | The unit of licensing                           |
| `name`            | string         | CRM     |                                                 |
| `address`         | object         | CRM     |                                                 |
| `lat`, `lng`      | number \| null | CRM     | SRS §6.8                                        |
| `phone`           | string \| null | CRM     | Formatted into `display.phone` by Core (SRS §7) |
| `email`           | string \| null | CRM     |                                                 |
| `display`         | object         | Core    |                                                 |
| `provider_extras` | object         | Adapter |                                                 |

## agent

| Field             | Type           | Source  | Notes                                  |
| ----------------- | -------------- | ------- | -------------------------------------- |
| `id`              | string         | CRM     |                                        |
| `name`            | string         | CRM     |                                        |
| `title`           | string \| null | CRM     | Job title, e.g. "Fastighetsmäklare"    |
| `phone`           | string \| null | CRM     | Formatted into `display.phone` by Core |
| `email`           | string \| null | CRM     |                                        |
| `image_url`       | string \| null | CRM     | A CDN URL. Core never hosts images     |
| `office_id`       | string \| null | CRM     | Reference                              |
| `display`         | object         | Core    |                                        |
| `provider_extras` | object         | Adapter |                                        |

## area

| Field             | Type           | Source  | Notes                                                                         |
| ----------------- | -------------- | ------- | ----------------------------------------------------------------------------- |
| `id`              | string         | CRM     |                                                                               |
| `name`            | string         | CRM     |                                                                               |
| `polygon`         | object \| null | CRM     | GeoJSON Polygon or MultiPolygon (SRS §6.8). Null when the CRM has no geometry |
| `display`         | object         | Core    |                                                                               |
| `provider_extras` | object         | Adapter |                                                                               |

## association

| Field             | Type   | Source  | Notes                    |
| ----------------- | ------ | ------- | ------------------------ |
| `id`              | string | CRM     |                          |
| `name`            | string | CRM     | The bostadsrättsförening |
| `display`         | object | Core    |                          |
| `provider_extras` | object | Adapter |                          |

## Proposed, needs a decision at Gate 2

Not in the schema. Each of these is something broker sites usually show, but none is named in the
SRS data contract, and AGENTS.md forbids inventing them. Approve the ones we need and they are
added as additive fields; the rest stay out.

| Datatype    | Candidate fields                                                                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| property    | `headline`, `description`, `monthly_fee`, `operating_cost`, `plot_area`, `build_year`, `floor`, `energy_class`, `tenure`, `balcony`, `elevator`, `bidding_open`, `documents` |
| office      | `opening_hours`, `website`, `image_url`, `organisation_number`                                                                                                               |
| agent       | `mobile`, `description`, `role_on_property` (agent's role per listing)                                                                                                       |
| area        | `municipality`, `parent_area_id`                                                                                                                                             |
| association | `organisation_number`, `address`, `built_year`, `fee_includes`                                                                                                               |

Two of these are shaped by the parity inventory (strategy §9, Phase 5), so the honest order is:
approve what is obviously needed now, and revisit the rest when the inventory arrives.

## Open question for Gate 2: images

Kowboy serves images through a separate CDN app, so the Vitec adapter is expected to leave
`images` and `image_url` empty. The fields stay in the contract because the SRS defines them and
another provider may fill them. Confirm that is what you want, or say the field should go.
