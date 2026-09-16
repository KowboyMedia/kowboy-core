# The universal data model: proposal for Gate 2

**Status: proposed 2026-09-16, not approved.** Nothing in `schemas/` changes until the decisions at
the end are answered by number (strategy §9, Gate 2). Until then `docs/field-tables.md` stays the
record of what is defined. Patric's answers of 2026-09-16 (relations, tenant scope, loose areas,
projects, files, fetch pace) are worked in below.

## What Gate 2 decides, and what it does not

Gate 2 decides the **technical shape** only: identity, the relations between the datatypes, the
change date, scope, and the convention by which everything else is carried. It does not decide
what any field means or how it is shown: mappings into closed enumerations, search scalars,
display strings and formatting belong to the rules-ledger phase (strategy §9, Phase 5, and §11),
and templates are per client, later.

## The shape

1. **One JSON document per item**, `data`, carrying **everything the CRM publishes** for that
   datatype: the CRM's advertising model mirrored under CRM-agnostic snake_case names and the
   CRM's own nesting. Nothing is hand-picked, so no field is a decision now, and no later template
   need becomes a Core change. The inventory is generated, not written:
   [data-model-reference.md](data-model-reference.md), every path with its source field and the
   CRM's description.
2. **Datatypes** are the SRS's five plus one: `property` (Vitec `AdvertisingEstate`), `agent`
   (`AdvertisingUser`), `office` (`AdvertisingOffice`), `area` (`AdvertisingArea`), `association`
   (`AdvertisingAssociation`) and `project` (`AdvertisingProject`, point 9). No CRM name appears in
   `data`, in a key or a value.
3. **Names** are the CRM's field names in snake_case (`StreetAddress` → `street_address`), nesting
   follows the CRM's objects. Mechanical, so traceable by construction. The first CRM fixes the
   shape; the second maps into it (the adapter bends to the engine, strategy §5.1) and adds only
   what it has and the first does not.
4. **Values** are carried as sent: numbers stay numbers, dates stay ISO 8601 strings, a CRM value
   that is an `{Id, Name}` wrapper becomes its id as a string, `null` where the CRM has no value,
   `[]` for a missing collection. Nothing is interpreted or formatted in `data`.
5. **The technical spine**, added on top:

   | Datatype | Field               | Source                                              | Note                                                                           |
   | -------- | ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
   | all      | `id`                | the CRM's `Id`                                      | SRS §6.9, identity                                                             |
   | all      | `display`           | rules                                               | SRS §6; `{}` until the ledger exists                                           |
   | all      | `provider_extras`   | SRS §6.4                                            | `{}`; never hashed                                                             |
   | property | `office_id`         | `Office.Id`                                         | Also the envelope `office_id`                                                  |
   | property | `agent_ids`         | `PrimaryAgentId`, `SecondaryAgentId`, primary first | SRS §6.9                                                                       |
   | property | `area_ids`          | `Address.Area.Id`, zero or one                      | As the CRM assigns it; no geographical matching (below)                        |
   | property | `association_id`    | `Extensions.HousingCooperative.Association.Id`      | SRS §6.9; needs `extend=housingCooperative`                                    |
   | property | `project_id`        | `ProjectId`                                         | The estate's project, null outside a project (point 9)                         |
   | agent    | `office_ids`        | `Offices[].Id`                                      | One or several offices; the order per office stays in `offices[].order_number` |
   | project  | `office_id`         | `Office.Id`                                         | Also the envelope `office_id`                                                  |
   | project  | `agent_ids`         | `PrimaryAgentId`, `SecondaryAgentId`, primary first | As property                                                                    |
   | project  | `area_ids`          | `Address.Area.Id`, zero or one                      | As property                                                                    |
   | envelope | `remote_updated_at` | the CRM's `ChangedAt`                               | SRS §3; the only "updated" timestamp                                           |

   A source field a spine field consumes is not mirrored (the office reference object, the two
   agent ids, `ProjectId`, `ChangedAt`). `area` has no relation at all: areas are loose (Patric),
   so Vitec's area `Office` reference is mirrored as plain data (`office.id`), not as a spine field.

   **Areas need no geographical matching in Core.** A Vitec estate carries exactly one assigned
   area (`Address.Area`), so `area_ids` holds zero or one id from Vitec, and holds several only
   when a CRM assigns several. Point-in-polygon search is the client's, per SRS §9 (MySQL
   `ST_Contains`, PostGIS), over the area's mirrored `coordinates`.

6. **Scope.** Every item belongs to a tenant, and the licensing filter runs on the tenant
   (Patric). The envelope `office_id` is set where the CRM names one office: `property`,
   `project`, and `office` itself. It is null on `agent` (several offices, in `office_ids`),
   `area` (loose) and `association` (reached only through the estates that name it). It serves
   subscriber-side filtering only (decision 2).
7. **What the adapter fetches.** Vitec's list endpoints return ids and change dates only, so every
   item is fetched by id; estates with
   `?extend=housingCooperative+condominium+farm+premises+commercialProperty+foreignProperty`
   (`docs/inputs/vitec/extend.md`), so the extensions are in `data` whenever they apply. The two
   agent extensions are not requested, on estates or on projects: agents are their own items,
   referenced by `agent_ids`. Projects have their own list and by-id endpoints and their own
   notification type. Associations have no list endpoint; they are fetched by the ids the estates
   carry, the way AC 14 already loads referenced entities.
8. **Not carried.** Files and documents (`Files[]` on estates and projects, association
   `Documents[]`): next-steps item 3 ignores them, a separate app serves them.
9. **Projects are a sixth datatype**, not folded into `property`. Vitec's project model shares the
   address, surroundings, images, links, marketing and viewings with the estate and differs in the
   rest: its own status flags (`Api_ProjectStatusFlags`: coming, running, sold out, …), price,
   fee, living space, rooms and plot as **ranges** over the project's estates (`Estates.Price`,
   …), `Sale`, `Producer`, and none of the estate's buildings, price, tenure or property extensions (its `Extensions` hold only the two agents). Folding
   it in would put a second shape and a second status vocabulary under one datatype, and every
   client, rule and template would have to tell the two apart by inspection. The relation runs one
   way: an estate names its project (`project_id`); clients group the other way.
10. **Fetch pace.** Vitec states no rate limit (Patric, and nothing in the documentation). The
    adapter runs at most five fetches at once, a setting of the adapter with 5 as the default:
    concurrency rather than requests per second, because it is the simpler of the two to make
    exact. That ceiling is what AC 29's "stay within its rate limit" means for Vitec.

## Left to the rules-ledger phase

The SRS's closed enumerations (`status`, `listing_type`), the §9 search scalars (`price`,
`rooms`, `living_space`, `lat`, `lng`, `published_at`, `sold_at`), `slug`, and every `display.*`
string. Until then the CRM's raw values for these are in `data` under their mirrored names
(`status`, `type`, `subtype`, `tenure`, `price.starting_price`, `buildings[].area.living`, …), so
nothing is lost. Vitec's enumeration values are in `docs/inputs/vitec/enumerations/` for when the
ledger is written. Before go-live, adding the spine fields then is a plain additive change.

## Decisions for Gate 2

1. **[core] The shape** (points 1 to 10) as the universal model, six datatypes. Approval means:
   `schemas/` gets these shapes, generated from the same conventions, and `docs/field-tables.md`
   becomes the record; `project` is added to the adapter API's datatypes, to each client's store
   (a post type, a table) and to `golden/fake/`. Needs approval (protected paths).
2. **[core] `licensed_offices`.** With licensing on the tenant (point 6), the connection field
   `licensed_offices` (SRS §3) and the criteria built on it (AC 9 unlicensed offices dropped, AC 14
   an added office loaded alone, AC 26 a removed office tombstoned) keep only a secondary role.
   Keep or drop. Suggested: keep as is, because an empty `licensed_offices` already means "every
   office the credential can see", so tenant-only licensing costs nothing today, and dropping is a
   contract change. Needs a decision.
3. **[core] Vocabulary.** The mirrored names are the first CRM's (point 3). The one open industry
   vocabulary for listing data is the RESO Data Dictionary (2.0; resources Property, Member,
   Office, Media; its Property resource is "fields commonly used in a Multiple Listing Service
   (MLS) listing"; dd.reso.org, read 2026-09-16). It is MLS-shaped: the association is a set of
   name and fee fields on the listing, not an entity, and Swedish tenure and area polygons have no
   direct home. Suggested: keep the mirror as it is, and borrow RESO's names in the ledger phase
   for the search scalars and `display`, which are additive, so nothing is renamed later (strategy
   §6). Needs a decision before `schemas/` is generated.
