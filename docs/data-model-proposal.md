# The universal data model: proposal for Gate 2

**Status: proposed 2026-09-16, not approved.** Nothing in `schemas/` changes until the decisions at
the end are answered by number (strategy §9, Gate 2). Until then `docs/field-tables.md` stays the
record of what is defined.

## What Gate 2 decides, and what it does not

Gate 2 decides the **technical shape** only: identity, the relations between the five datatypes,
the change date, scope, and the convention by which everything else is carried. It does not decide
what any field means or how it is shown: mappings into closed enumerations, search scalars,
display strings and formatting belong to the rules-ledger phase (strategy §9, Phase 5, and §11),
and templates are per client, later.

## The shape

1. **One JSON document per item**, `data`, carrying **everything the CRM publishes** for that
   datatype: the CRM's advertising model mirrored under CRM-agnostic snake_case names and the
   CRM's own nesting. Nothing is hand-picked, so no field is a decision now, and no later template
   need becomes a Core change. The inventory is generated, not written:
   [data-model-reference.md](data-model-reference.md), 480 paths across the five datatypes,
   each with its source field and the CRM's description.
2. **Datatypes** are the SRS's five: `property` (Vitec `AdvertisingEstate`), `agent`
   (`AdvertisingUser`), `office` (`AdvertisingOffice`), `area` (`AdvertisingArea`), `association`
   (`AdvertisingAssociation`). No CRM name appears in `data`, in a key or a value.
3. **Names** are the CRM's field names in snake_case (`StreetAddress` → `street_address`), nesting
   follows the CRM's objects. Mechanical, so traceable by construction. The first CRM fixes the
   shape; the second maps into it (the adapter bends to the engine, strategy §5.1) and adds only
   what it has and the first does not.
4. **Values** are carried as sent: numbers stay numbers, dates stay ISO 8601 strings, a CRM value
   that is an `{Id, Name}` wrapper becomes its id as a string, `null` where the CRM has no value,
   `[]` for a missing collection. Nothing is interpreted or formatted in `data`.
5. **The technical spine**, added on top:

   | Datatype | Field               | Source                                              | Note                                        |
   | -------- | ------------------- | --------------------------------------------------- | ------------------------------------------- |
   | all      | `id`                | the CRM's `Id`                                      | SRS §6.9, identity                          |
   | all      | `display`           | rules                                               | SRS §6; `{}` until the ledger exists        |
   | all      | `provider_extras`   | SRS §6.4                                            | `{}`; never hashed                          |
   | property | `office_id`         | `Office.Id`                                         | Also the envelope `office_id` and licensing |
   | property | `agent_ids`         | `PrimaryAgentId`, `SecondaryAgentId`, primary first | SRS §6.9                                    |
   | property | `area_ids`          | `Address.Area.Id`, zero or one                      | SRS §6.9                                    |
   | property | `association_id`    | `Extensions.HousingCooperative.Association.Id`      | SRS §6.9; needs `extend=housingCooperative` |
   | agent    | `office_ids`        | `Offices[].Id`                                      | A user belongs to several offices at once   |
   | area     | `office_id`         | `Office.Id`                                         | Also the envelope `office_id`               |
   | envelope | `remote_updated_at` | the CRM's `ChangedAt`                               | SRS §3; the only "updated" timestamp        |

   A source field a spine field consumes is not mirrored (the office reference object, the two
   agent ids, `ChangedAt`).

6. **Scope.** `property`, `office` and `area` are office-scoped (their envelope `office_id` is the
   estate's office, the office itself, the area's office). `agent` and `association` are
   tenant-wide (`office_id` null): a Vitec user belongs to several offices, which is data, and an
   association is reached only through the estates that name it.
7. **What the adapter fetches.** Vitec's list endpoints return ids and change dates only, so every
   item is fetched by id; estates with
   `?extend=housingCooperative+condominium+farm+premises+commercialProperty+foreignProperty`
   (`docs/inputs/vitec/extend.md`), so the extensions are in `data` whenever they apply. The two
   agent extensions are not requested: agents are their own items, referenced by `agent_ids`.
   Associations have no list endpoint; they are fetched by the ids the estates carry, the way
   AC 14 already loads referenced entities.
8. **Not carried.** Files and documents (`Files[]`, association `Documents[]`): next-steps item 3
   ignores them, a separate app serves them. Projects (`AdvertisingProject`): a Vitec datatype the
   SRS does not have; an estate's `project_id` is carried as a plain value.

## Left to the rules-ledger phase

The SRS's closed enumerations (`status`, `listing_type`), the §9 search scalars (`price`,
`rooms`, `living_space`, `lat`, `lng`, `published_at`, `sold_at`), `slug`, and every `display.*`
string. Until then the CRM's raw values for these are in `data` under their mirrored names
(`status`, `type`, `subtype`, `tenure`, `price.starting_price`, `buildings[].area.living`, …), so
nothing is lost. Vitec's enumeration values are in `docs/inputs/vitec/enumerations/` for when the
ledger is written. Before go-live, adding the spine fields then is a plain additive change.

## Decisions for Gate 2

1. **The shape** (points 1 to 5) as the universal model. Approval means `schemas/` gets these
   shapes, generated from the same conventions, and `docs/field-tables.md` becomes the record.
   Needs approval.
2. **Scope** as in point 6: agents and associations tenant-wide, the rest office-scoped. Needs a
   decision, because it is what the licensing filter runs on.
3. **Not carried** as in point 8: files, documents and projects. Needs a decision.
4. **Rate limits**: not documented by Vitec (open question 7). Ask Vitec, or set a conservative
   pace. Needs an answer before the adapter's fetch loop is tuned.
