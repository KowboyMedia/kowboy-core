# The universal data model: proposal for Gate 2

**Status: proposed 2026-09-16, not approved.** Nothing in `schemas/` changes until the decisions at
the end are answered by number (strategy §9, Gate 2). Until then `docs/field-tables.md` stays the
record of what is defined.

## The shape, in one paragraph

`data` is one JSON document per item. It carries **everything the CRM publishes** for that
datatype, nothing hand-picked: the CRM's advertising model, mirrored under CRM-agnostic
snake_case names and the CRM's own nesting, with the SRS's spine on top: id references, the closed
enumerations, coordinates, the search scalars of SRS §9, `display` and `provider_extras`. Which of
it a site shows is a template decision, taken later per client; the document is complete so that
choice never needs a Core change. The full inventory is generated, not written:
[data-model-reference.md](data-model-reference.md), 459 paths across the five datatypes, each
with its source field.

## Conventions (what Gate 2 approves)

1. **Datatypes** are the SRS's five: `property` (Vitec `AdvertisingEstate`), `agent`
   (`AdvertisingUser`), `office` (`AdvertisingOffice`), `area` (`AdvertisingArea`), `association`
   (`AdvertisingAssociation`). No CRM name appears in `data`, in a key or a value.
2. **Names** are the CRM's field names in snake_case (`StreetAddress` → `street_address`,
   `IsVisibleInStaffList` → `is_visible_in_staff_list`), and nesting follows the CRM's objects
   (`address`, `sale`, `buildings[]`, `extensions.housing_cooperative`). This is mechanical, so the
   inventory is traceable by construction. The first CRM fixes the shape; the second maps into it
   (adapter bends to engine, strategy §5.1) and adds only what it has and the first does not.
3. **The spine** is added on top and wins any name collision: `id`, `status`, `listing_type`,
   `tenure`, `office_id`, `agent_ids`, `area_ids`, `association_id`, `lat`, `lng`, `slug`,
   `price`, `rooms`, `living_space`, `additional_space`, `published_at`, `sold_at`, `images`,
   `display`, `provider_extras` on property; the equivalents on the other datatypes are listed in
   the reference. A source field a spine field consumes is not mirrored (the office reference,
   the two agent ids, the coordinate object). One collision is renamed: Vitec's `Price` object is
   `pricing`, because the SRS's `price` is a number.
4. **Enumerations.** A CRM value that is a `{Id, Name}` wrapper becomes its id as a string. Three
   are closed sets (below); the rest are open strings, so a new CRM value breaks nothing (SRS §6).
   Unknown values of a closed set map to `other`, the raw id goes to `provider_extras` (SRS §6.5).
5. **Values.** Numbers stay numbers, dates stay ISO 8601 strings as the CRM sends them, `null`
   where the CRM has no value, `[]` for a missing collection. Nothing is formatted in `data`;
   formatting is `display.*`, one rule per string in the ledger.
6. **Scope.** `property`, `office` and `area` are office-scoped (the envelope's `office_id` is the
   estate's office, the office itself, the area's office). `agent` and `association` are
   tenant-wide (`office_id` null): a Vitec user belongs to several offices at once, which is data
   (`office_ids`, `offices[]`), and associations are reached only through the estates that name
   them.
7. **What the adapter fetches.** Vitec's list endpoints return ids and change dates only, so every
   item is fetched by id; estates with `?extend=housingCooperative+condominium+farm+premises+commercialProperty+foreignProperty`
   (`docs/inputs/vitec/extend.md`), so the extensions are in `data` whenever they apply. The two
   agent extensions are not requested: the agents are their own items, referenced by `agent_ids`.
8. **Not carried.** Files and documents (`Files[]`, association `Documents[]`): next-steps item 3
   ignores them, a separate app serves them. Projects (`AdvertisingProject`): a Vitec datatype the
   SRS does not have; an estate's `project_id` is carried as data. Brands: `brand_id` on the
   office is carried, there is no brand datatype.

## Closed enumerations (SRS §6.5)

The source values are Vitec's, complete; the mappings are first drafts for the ledger.

### `status`: `coming_soon | for_sale | sold | withdrawn`, rule R-001

Source `Status.Id` (`docs/inputs/vitec/enumerations/Api_EstateStatus.md`). The list endpoint
returns published estates only, so most pre-assignment values never arrive.

| Vitec `EstateStatus`                                                                                              | Proposed    | Note                                   |
| ----------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------- |
| Coming, SoonForSale, Advantage                                                                                    | coming_soon | Kommande, Snart till salu, Försprång   |
| ForSale, Booked                                                                                                   | for_sale    | "Bokad" needs confirming (decision 3)  |
| Sold, SoldReferenceObject, AppointedAdmission                                                                     | sold        | Tillträdd is a completed sale          |
| AssignmentAttempt, AssignmentAccepted, Resting, NoAssignment, AssignmentWithdrawn, ReservedNotForSale, NotForSale | withdrawn   | Not for sale, whatever the reason      |
| ReadyForRent, TentativelyRented, Rented, ReservedNotForRental                                                     | ?           | Rentals have no SRS value (decision 3) |
| Running, Soldout, SoldoutReferenceProject, Undefined                                                              | other       | Project-only or unset                  |

### `listing_type`: `apartment | house | townhouse | plot | commercial | other`, rule R-002

Source `Subtype.Id` (`Api_EstateSubType`, 30 values) first, then `Type.Id` (`Api_EstateClassType`,
9 values) when the subtype is missing.

| Vitec subtype                                                                    | Proposed       | Vitec class type (fallback)     | Proposed   |
| -------------------------------------------------------------------------------- | -------------- | ------------------------------- | ---------- |
| Apartment                                                                        | apartment      | HousingCooperative, Condominium | apartment  |
| DetachedHouse, LinkedHouse, DuplexHouse                                          | house          | House                           | house      |
| TownHouse                                                                        | townhouse      |                                 |            |
| Plot                                                                             | plot           | Plot                            | plot       |
| CommercialProperty\*, Premises\*                                                 | commercial     | CommercialProperty, Premises    | commercial |
| Cottage                                                                          | ? (decision 4) | Cottage                         | ?          |
| Farm, FarmAgriculture, FarmForest, FarmParceled, FarmHorse, FarmHouseOnly, Other | other          | Farm, ForeignProperty           | other      |

### `tenure`: `freehold | leasehold | lease | tenant_ownership | share | condominium | tenancy | company | other`, rule R-004

A new closed set (SRS §7 lists tenure among the values to normalize). Source `Tenure.Id`
(`Api_EstateTenure`): Freehold, Leasehold, Lease, TenantOwnership, Share, AssociationShare
(→ share), Condominium, Tenancy, Company, Project and UnrealAssociation (→ other; Vitec marks both
as leftovers).

## The rules the spine needs (ledger entries, not written here)

| Rule  | Computes                                    | From                                                                |
| ----- | ------------------------------------------- | ------------------------------------------------------------------- |
| R-001 | `status`                                    | `Status.Id`, table above                                            |
| R-002 | `listing_type`                              | `Subtype.Id`, `Type.Id`, table above                                |
| R-003 | `rooms`, `living_space`, `additional_space` | the main building among `buildings[]` (decision 5)                  |
| R-004 | `tenure`                                    | `Tenure.Id`, table above                                            |
| R-005 | `price`                                     | `pricing.starting_price`; price on request → null (SRS §11 example) |
| R-006 | `sold_at`                                   | `sale.contract_date` when `status` is `sold`                        |
| R-007 | `slug`                                      | `address.street_address`, `address.postal_town` (SRS §6.7)          |
| R-0xx | every `display.*` string                    | the ledger, one entry per string (strategy §11)                     |

## Decisions for Gate 2

1. **The conventions above** and the generated reference as the universal model. Approval means
   `schemas/` gets these shapes, generated from the same conventions, and `docs/field-tables.md`
   becomes the record. Needs approval.
2. **Images.** Core carries image ids, categories, captions and order, and the separate CDN app
   serves the bytes by id, so no Vitec URL is stored. Alternative: also carry Vitec's CDN URLs
   (`Images[].CdnReferences[]`), which SRS §6.6 describes. The reference assumes ids only. Needs a
   decision.
3. **Rentals and "Booked".** Vitec's ReadyForRent, TentativelyRented, Rented and
   ReservedNotForRental have no SRS status: grow the enum by `for_rent | rented` (additive), or
   drop rentals at the write path. And is "Booked" for sale? Needs a decision.
4. **Cottages** (fritidshus): `house` or `other`? Needs a decision.
5. **The main building.** Vitec's `buildings[]` is a collection; R-003 reads the first one for
   `rooms`, `living_space` and `additional_space`. Right for homes; the rest stays in
   `buildings[]` anyway. Needs a decision.
6. **Scope** as in convention 6: agents and associations tenant-wide, the rest office-scoped.
   Needs a decision.
7. **Rate limits.** Not documented by Vitec (open question 7). Ask Vitec, or set a conservative
   pace. Needs an answer before the adapter's fetch loop is tuned.
