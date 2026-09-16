# The universal data model: proposal for Gate 2

**Status: proposed 2026-09-16, not approved.** Nothing in `schemas/` changes until the decisions at
the end are answered by number (strategy §9, Gate 2). Until then `docs/field-tables.md` stays the
record of what is defined.

## How to read this

- Every field names where it comes from: a Vitec field (`Model.Field`, from the model pages under
  `docs/inputs/vitec/models/`) or an SRS rule. Vitec is the only CRM documented so far; Mspecs maps
  into the same fields later, and nothing here is Vitec's name for anything.
- Types: `string`, `number`, `boolean`, `date`, `date-time`, `enum`, `object`, `array`. Any scalar
  is `null` when the CRM has no value.
- **Rule** marks a value the rules ledger must define (strategy §11): every mapping into a closed
  enumeration and every `display.*` string. The proposal names the inputs and never the rule.
- **Tier A** is the SRS's own example and the §9 search filters: the model cannot do without them.
  **Tier B** is what a listing page shows, taken straight from Vitec; strike any row you do not
  want, and the parity inventory (Phase 5) may add or remove rows later, additively.
- How the adapter gets the full model: Vitec's list endpoints return only `Id`, `CustomerId` and
  `ChangedAt` (the limited model), so every item is fetched by id. Estates are fetched with
  `?extend=housingCooperative+primaryAgent+secondaryAgent` (the Extend API, `docs/inputs/vitec/extend.md`),
  which is where the association reference lives. Associations have no list endpoint: they are
  fetched by the ids the estates carry, the way AC 14 already loads referenced entities.

## Closed enumerations (SRS §6.5)

Unknown CRM values map to `other`, and the raw value goes to `provider_extras` (SRS §6.5). The
mappings below are proposals for the ledger to confirm; the source values are Vitec's, complete.

### `status`: `coming_soon | for_sale | sold | withdrawn` (SRS §6.5)

Source: `AdvertisingEstate.Status.Id`, values in `docs/inputs/vitec/enumerations/Api_EstateStatus.md`.
The list endpoint returns published estates only, so most pre-assignment values never arrive.

| Vitec `EstateStatus`                                                                                              | Proposed    | Note                                       |
| ----------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------ |
| Coming, SoonForSale, Advantage                                                                                    | coming_soon | "Kommande", "Snart till salu", "Försprång" |
| ForSale, Booked                                                                                                   | for_sale    | "Bokad" needs confirming (decision 4)      |
| Sold, SoldReferenceObject, AppointedAdmission                                                                     | sold        | "Tillträdd" = possession taken             |
| AssignmentAttempt, AssignmentAccepted, Resting, NoAssignment, AssignmentWithdrawn, ReservedNotForSale, NotForSale | withdrawn   | Not for sale, whatever the reason          |
| ReadyForRent, TentativelyRented, Rented, ReservedNotForRental                                                     | ?           | Rentals have no SRS value (decision 4)     |
| Running, Soldout, SoldoutReferenceProject, Undefined                                                              | other       | Project-only or unset                      |

### `listing_type`: `apartment | house | townhouse | plot | commercial | other` (SRS §6.5)

Source: `AdvertisingEstate.Subtype.Id` (`Api_EstateSubType`, 30 values) first, then
`AdvertisingEstate.Type.Id` (`Api_EstateClassType`, 9 values) when the subtype is missing.

| Vitec subtype                                                                    | Proposed   | Vitec class type (fallback)     | Proposed   |
| -------------------------------------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| Apartment                                                                        | apartment  | HousingCooperative, Condominium | apartment  |
| DetachedHouse, LinkedHouse, DuplexHouse                                          | house      | House                           | house      |
| TownHouse                                                                        | townhouse  |                                 |            |
| Plot                                                                             | plot       | Plot                            | plot       |
| CommercialProperty\*, Premises\*                                                 | commercial | CommercialProperty, Premises    | commercial |
| Cottage                                                                          | house?     | Cottage                         | house?     |
| Farm, FarmAgriculture, FarmForest, FarmParceled, FarmHorse, FarmHouseOnly, Other | other      | Farm, ForeignProperty           | other      |

Cottage is decision 5.

### `tenure`: `freehold | leasehold | lease | tenant_ownership | share | condominium | tenancy | company | other`

A new closed set (SRS §7 lists tenure among the values to normalize). Source:
`AdvertisingEstate.Tenure.Id` (`Api_EstateTenure`): Freehold, Leasehold, Lease, TenantOwnership,
Share, AssociationShare (→ share), Condominium, Tenancy, Company, Project and UnrealAssociation
(→ other; Vitec marks both as leftovers).

### `fee_frequency`

Source: `AdvertisingRecurringFee.Frequency` (`Models_MoneyRecurringFrequency`). The values are
Vitec's, lower-cased, closed.

## `property` (Vitec `AdvertisingEstate`)

Office-scoped: the envelope's `office_id` is `Office.Id`, which is also how `licensed_offices`
filters (SRS §3). `remote_updated_at` is `ChangedAt`.

| Field                   | Type      | Tier | Source                                                                                         | Note                                                                                                      |
| ----------------------- | --------- | ---- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `id`                    | string    | A    | `Id`                                                                                           | SRS §6.9                                                                                                  |
| `reference`             | string    | B    | `ReferenceId`                                                                                  | "Objektnummer", shown on listings                                                                         |
| `status`                | enum      | A    | `Status.Id`                                                                                    | Rule (mapping above); §9 filter                                                                           |
| `listing_type`          | enum      | A    | `Subtype.Id`, `Type.Id`                                                                        | Rule (mapping above); §9 filter                                                                           |
| `tenure`                | enum      | B    | `Tenure.Id`                                                                                    | Rule (mapping above)                                                                                      |
| `office_id`             | string    | A    | `Office.Id`                                                                                    | SRS §6.9; §9 filter                                                                                       |
| `agent_ids`             | string[]  | A    | `PrimaryAgentId`, `SecondaryAgentId`, primary first, nulls dropped                             | SRS §6.9                                                                                                  |
| `area_ids`              | string[]  | A    | `Address.Area.Id` (zero or one)                                                                | SRS §6.9; §9 filter                                                                                       |
| `association_id`        | string    | A    | `Extensions.HousingCooperative.Association.Id`                                                 | SRS §6.9; needs `extend=housingCooperative`                                                               |
| `address.street`        | string    | A    | `Address.StreetAddress`                                                                        | SRS example                                                                                               |
| `address.postal_code`   | string    | A    | `Address.ZipCode.Value`                                                                        | SRS example                                                                                               |
| `address.city`          | string    | A    | `Address.PostalTown`                                                                           | SRS example                                                                                               |
| `address.municipality`  | string    | B    | `Address.Municipality`                                                                         |                                                                                                           |
| `address.country_code`  | string    | B    | `Address.CountryCode`                                                                          |                                                                                                           |
| `address.area_name`     | string    | B    | `Address.Area.Name`                                                                            | The area's name as the estate carries it                                                                  |
| `address.directions`    | string    | B    | `Address.Directions`                                                                           |                                                                                                           |
| `lat`, `lng`            | number    | A    | `Address.Wgs84Coordinate.Latitude`, `.Longitude`                                               | SRS §6.8; §9 bounding box                                                                                 |
| `slug`                  | string    | A    | Rule from `address.street` and `address.city`                                                  | SRS §6.7                                                                                                  |
| `price`                 | number    | A    | `Price.StartingPrice`                                                                          | SRS example; §9 filter and sort. Rule: on request → null                                                  |
| `price_text`            | string    | B    | `Price.Text`                                                                                   | Input to the price-on-request rule                                                                        |
| `sold_price`            | number    | B    | `Price.FinalPrice`                                                                             | Rule: when a sold price is shown (§11 example)                                                            |
| `currency`              | string    | B    | `Currency`                                                                                     |                                                                                                           |
| `fee`                   | number    | B    | `Fees.Recurring.Value`                                                                         | Månadsavgift or rent                                                                                      |
| `fee_frequency`         | enum      | B    | `Fees.Recurring.Frequency`                                                                     |                                                                                                           |
| `fee_description`       | string    | B    | `Fees.Recurring.Description`                                                                   |                                                                                                           |
| `operating_cost`        | number    | B    | `Expenses.Operation.Sum`                                                                       | Driftskostnad per year                                                                                    |
| `living_space`          | number    | A    | `Buildings[0].Area.Living`                                                                     | SRS example; §9 filter. Decision 6 (buildings)                                                            |
| `additional_space`      | number    | A    | `Buildings[0].Area.GrossFloor`                                                                 | SRS example                                                                                               |
| `plot_size`             | number    | B    | `Exterior.Plot.Size`                                                                           | Tomtarea                                                                                                  |
| `rooms`                 | number    | A    | `Buildings[0].NumberOfRooms`                                                                   | SRS example; §9 filter                                                                                    |
| `bedrooms`              | number    | B    | `Buildings[0].Bedrooms.Count`                                                                  |                                                                                                           |
| `bathrooms`             | number    | B    | `Buildings[0].NumberOfBathRooms`                                                               |                                                                                                           |
| `floor`                 | number    | B    | `Buildings[0].Floor.Number`                                                                    |                                                                                                           |
| `floors_total`          | number    | B    | `Buildings[0].Floor.Total`                                                                     |                                                                                                           |
| `elevator`              | boolean   | B    | `Buildings[0].Elevator.IsAvailable`                                                            | Vitec: null means not stated                                                                              |
| `year_built`            | string    | B    | `Buildings[0].YearBuilt.Text`                                                                  | Vitec says to present `Text`, not `Numeric`                                                               |
| `building_type`         | string    | B    | `Buildings[0].Type`                                                                            |                                                                                                           |
| `energy_class`          | string    | B    | `Buildings[0].EnergyDeclaration.Class`                                                         | A to G                                                                                                    |
| `energy_consumption`    | number    | B    | `Buildings[0].EnergyDeclaration.Consumption`                                                   | kWh/m² per year                                                                                           |
| `heading`               | string    | B    | `Sale.Heading`                                                                                 | Säljrubrik                                                                                                |
| `phrase`                | string    | B    | `Sale.Phrase`                                                                                  | Säljfras                                                                                                  |
| `summary`               | string    | B    | `Sale.ShortDescription`                                                                        |                                                                                                           |
| `description`           | string    | B    | `Sale.Description`                                                                             |                                                                                                           |
| `other_information`     | string    | B    | `Sale.OtherInformation`                                                                        |                                                                                                           |
| `interior`              | string    | B    | `Buildings[0].Interior`                                                                        |                                                                                                           |
| `surroundings`          | object    | B    | `Surroundings.Service`, `.Communication`, `.Area`, `.Parking`, `.Other`                        | Keys `service`, `communication`, `area`, `parking`, `other`                                               |
| `exterior`              | array     | B    | `Exterior.Entries[]`: `Type.Id`, `IsAvailable`, `Size`, `Description`                          | Items `{type, available, size, description}`; types Balcony, Parking, Pool, Terrace, Patio                |
| `possession`            | string    | B    | `Sale.PossessionEstimation`                                                                    | Tillträde, as text                                                                                        |
| `possession_at`         | date      | B    | `Sale.PossessionAt`                                                                            |                                                                                                           |
| `published_at`          | date-time | A    | `Marketing.PublishedAt`                                                                        | SRS example; §9 default sort                                                                              |
| `sold_at`               | date      | A    | `Sale.ContractDate`                                                                            | SRS example; §9 sort. Rule: only when `status` is sold                                                    |
| `is_new_home`           | boolean   | B    | `Marketing.IsNewHome`                                                                          | Nyproduktion badge                                                                                        |
| `viewings`              | array     | A    | `Viewings[]`: `Id`, `StartsAt`, `EndsAt`, `Comment`, `IsDigital`                               | SRS example; items `{id, starts_at, ends_at, comment, is_digital}`. Past ones hidden by the site (SRS §7) |
| `images`                | array     | A    | `Images[]`: `Id`, `Category.Id`, `Name`, `Description`, list order                             | SRS §6.6; items `{id, category, name, description, sort}`. URLs: decision 2                               |
| `links`                 | array     | B    | `Links[]`: `Name`, `Category.Id`, `Url`                                                        | Video, 3D and other media; items `{name, category, url}`                                                  |
| `bidding`               | object    | B    | `Bidding.IsActive`, `.IsVerified`, `.Bids[]` (`PlacedAt`, `Amount`, `Alias`, `IsCanceled`)     | `{active, verified, bids: [{placed_at, amount, alias, canceled}]}`                                        |
| `tags`                  | array     | B    | `Tags[]`: `Type.Id`, `Names[]`                                                                 | Items `{type, names}`; types SaleMethod, SpecialFeature                                                   |
| `apartment_number`      | string    | B    | `Extensions.HousingCooperative.ApartmentNumber`                                                |                                                                                                           |
| `display`               | object    | A    | Rules                                                                                          | Keys below                                                                                                |
| `provider_extras.vitec` | object    | A    | Raw `Status.Id`, `Type.Id`, `Subtype.Id`, `Tenure.Id`, `ProjectId`, and what is left out below | SRS §6.4, never hashed                                                                                    |

## `agent` (Vitec `AdvertisingUser`)

Tenant-wide (`office_id` null): a Vitec user belongs to several offices at once, so the offices
are data, not scope (decision 7). `remote_updated_at` is `ChangedAt`.

| Field                   | Type     | Tier | Source                                                   | Note                                        |
| ----------------------- | -------- | ---- | -------------------------------------------------------- | ------------------------------------------- |
| `id`                    | string   | A    | `Id`                                                     | SRS §6.9                                    |
| `name`                  | string   | A    | `Name`                                                   |                                             |
| `title`                 | string   | B    | `Title`                                                  |                                             |
| `category`              | string   | B    | `Category`                                               |                                             |
| `email`                 | string   | B    | `EmailAddress`                                           |                                             |
| `phone`                 | string   | B    | `Telephone.Public.Msisdn`, else `Telephone.Cell.Msisdn`  | Rule: which number is public; display below |
| `description`           | string   | B    | `Description`                                            |                                             |
| `spoken_languages`      | string[] | B    | `SpokenLanguages`                                        |                                             |
| `image_id`              | string   | B    | `Image.Id`                                               | The portrait; decision 2                    |
| `offices`               | array    | A    | `Offices[]`: `Id`, `OrderNumber`, `IsVisibleInStaffList` | Items `{office_id, order, visible}`         |
| `visible`               | boolean  | B    | `IsVisibleInStaffList`                                   | Staff list on the site                      |
| `reviews`               | array    | B    | `Reviews[]`: `Text`, `AuthorName`                        | Items `{text, author}`, newest first        |
| `display`               | object   | A    | Rules                                                    |                                             |
| `provider_extras.vitec` | object   | A    | Anything left out                                        |                                             |

## `office` (Vitec `AdvertisingOffice`)

Office-scoped: the envelope's `office_id` is its own `Id`. `remote_updated_at` is `ChangedAt`.

| Field                   | Type   | Tier | Source                              | Note                                   |
| ----------------------- | ------ | ---- | ----------------------------------- | -------------------------------------- |
| `id`                    | string | A    | `Id`                                | SRS §6.9                               |
| `name`                  | string | A    | `Name`                              |                                        |
| `address.street`        | string | B    | `StreetAddress`                     |                                        |
| `address.postal_code`   | string | B    | `ZipCode.Value`                     |                                        |
| `address.city`          | string | B    | `PostalTown`                        |                                        |
| `phone`                 | string | B    | `Telephone.Switch.Msisdn`           |                                        |
| `email`                 | string | B    | `EmailAddress`                      |                                        |
| `description`           | string | B    | `Description`                       |                                        |
| `seat`                  | string | B    | `Seat`                              | Säte, for the footer                   |
| `lat`, `lng`            | number | A    | `Coordinate.Latitude`, `.Longitude` | SRS §6.8                               |
| `brand_id`              | string | B    | `BrandId`                           | Vitec's brand for the site; decision 8 |
| `display`               | object | A    | Rules                               |                                        |
| `provider_extras.vitec` | object | A    | Anything left out                   |                                        |

## `area` (Vitec `AdvertisingArea`)

Office-scoped: Vitec areas belong to an office (`Office.Id`), which becomes the envelope's
`office_id`. `remote_updated_at` is `ChangedAt`.

| Field                   | Type   | Tier | Source                                                        | Note                        |
| ----------------------- | ------ | ---- | ------------------------------------------------------------- | --------------------------- |
| `id`                    | string | A    | `Id`                                                          | SRS §6.9                    |
| `name`                  | string | A    | `Name`                                                        |                             |
| `polygon`               | object | A    | `Coordinates` (GeoJSON MultiPolygon, longitude then latitude) | SRS §6.8; §9 polygon search |
| `municipality_code`     | string | B    | `CountyMunicipalityCode`                                      | LKF                         |
| `surroundings`          | object | B    | `Surroundings.*`, same keys as on property                    |                             |
| `images`                | array  | B    | `Images[]`, same shape as on property                         | Decision 2                  |
| `display`               | object | A    | Rules                                                         |                             |
| `provider_extras.vitec` | object | A    | Anything left out                                             |                             |

## `association` (Vitec `AdvertisingAssociation`)

Tenant-wide (`office_id` null). Fetched by the ids estates carry; there is no list endpoint.
`remote_updated_at` is `ChangedAt`.

| Field                   | Type   | Tier | Source                                                                                                                                                                                    | Note                                                                                                             |
| ----------------------- | ------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`                    | string | A    | `Id`                                                                                                                                                                                      | SRS §6.9                                                                                                         |
| `name`                  | string | A    | `Name`                                                                                                                                                                                    |                                                                                                                  |
| `corporate_number`      | string | B    | `CorporateNumber`                                                                                                                                                                         |                                                                                                                  |
| `organizational_form`   | string | B    | `OrganizationalForm.Id` (`Association_OrganizationalForm`)                                                                                                                                | Kept as Vitec's id                                                                                               |
| `genuine`               | string | B    | `GenuineAssociation.Id` (`Association_AssociationTaxation`)                                                                                                                               | Äkta or oäkta                                                                                                    |
| `email`                 | string | B    | `Email`                                                                                                                                                                                   |                                                                                                                  |
| `homepage`              | string | B    | `HomePage`                                                                                                                                                                                |                                                                                                                  |
| `apartments`            | number | B    | `NumberOfApartments`                                                                                                                                                                      |                                                                                                                  |
| `rental_apartments`     | number | B    | `NumberOfRentalApartments`                                                                                                                                                                |                                                                                                                  |
| `premises`              | number | B    | `NumberOfPremises`                                                                                                                                                                        |                                                                                                                  |
| `descriptions`          | object | B    | `Descriptions.*`: GeneralAboutAssociation, Renovations, Parking, TvAndBroadband, Courtyard, SharedSpaces, Insurance, Other                                                                | Keys `general`, `renovations`, `parking`, `tv_and_broadband`, `courtyard`, `shared_spaces`, `insurance`, `other` |
| `economy`               | object | B    | `Economy.*`: MonthlyFeeInformation, Finances, SublettingPolicy, TheAssociationOwnTheGround, TransferFee, TransferFeePaidBy, PledgeFee, AllowLegalPersonAsBuyer, AllowsSharedOwnershipInfo | Same names in snake_case                                                                                         |
| `contact`               | object | B    | `PublicContact`: Name, CellPhone, OtherPhone, Email                                                                                                                                       | `{name, phone, other_phone, email}`; null when Vitec has none                                                    |
| `display`               | object | A    | Rules                                                                                                                                                                                     |                                                                                                                  |
| `provider_extras.vitec` | object | A    | Anything left out                                                                                                                                                                         |                                                                                                                  |

## `display` keys: inputs only, formats are ledger entries

| Datatype    | Key                          | Inputs                                            |
| ----------- | ---------------------------- | ------------------------------------------------- |
| property    | `price`                      | `price`, `price_text`, `currency`                 |
| property    | `sold_price`                 | `sold_price`, `currency`                          |
| property    | `fee`                        | `fee`, `fee_frequency`                            |
| property    | `operating_cost`             | `operating_cost`                                  |
| property    | `living_space`               | `living_space`, `additional_space` ("82 + 12 m²") |
| property    | `plot_size`                  | `plot_size`                                       |
| property    | `rooms`                      | `rooms`                                           |
| property    | `floor`                      | `floor`, `floors_total`, `elevator`               |
| property    | `address`                    | `address.street`, `address.city`                  |
| property    | `status`                     | `status` (Swedish label)                          |
| property    | `listing_type`               | `listing_type` (Swedish label)                    |
| property    | `tenure`                     | `tenure` (Swedish label)                          |
| property    | `year_built`                 | `year_built`                                      |
| property    | `energy_class`               | `energy_class`                                    |
| agent       | `phone`                      | `phone`                                           |
| office      | `phone`, `address`           | `phone`; `address.*`                              |
| association | `transfer_fee`, `pledge_fee` | `economy.transfer_fee`, `economy.pledge_fee`      |

## Left out on purpose

Everything below is Vitec-specific or not shown on a listing today. It lands in
`provider_extras.vitec` where cheap (ids and small objects) and is otherwise not fetched. Any of it
can be added later as an additive change (strategy §6).

- **Projects** (`AdvertisingProject`, nyproduktion): a datatype Vitec has and the SRS does not. An
  estate's `ProjectId` goes to `provider_extras`. Decision 9.
- **Files and documents** (`Files[]`, association `Documents[]`): next-steps item 3 says images and
  documents are ignored; a separate app serves them.
- **Taxation, pledges, enrollments, electricity, inspection, plot details, building services,
  renovations, ventilation, architecture, rooms list**: not on a listing page. `provider_extras`.
- **Farm, premises, commercial-property and foreign-property extensions**: whole sub-models for
  rare listing types. Not fetched until a site needs them (their `listing_type` is `other` or
  `commercial` meanwhile).
- **Brands** (`Advertising/Brand`): Vitec's site brands; only `brand_id` is kept on the office.
- **Per-estate overrides of an association's texts and economy**
  (`Extensions.HousingCooperative.Association.OverrideDescription`, `.OverrideEconomy`). Decision 10.
- **Finances of a cooperative apartment** (`HousingCooperativeFinances`: shares, indirect net debt,
  repair fund): `provider_extras` until a site shows them.

## Decisions for Gate 2

1. **The tables above**, as the universal model: approve as they stand, or name the rows to strike
   (Tier B rows are the candidates). Approval means `schemas/` gets these fields, additively, and
   `docs/field-tables.md` becomes the record. Needs approval.
2. **Images**: Core carries image ids, categories, captions and order, and the separate CDN app
   serves the bytes by id, so no Vitec URL is stored. Alternative: store Vitec's CDN URLs
   (`Images[].CdnReferences[]`), which the SRS §6.6 describes. Needs a decision; the tables assume
   ids only.
3. **Status and listing-type mappings** go to the rules ledger as entries R-001 and R-002, with the
   proposed tables above as their first draft, for you to correct. Needs the ledger entries.
4. **Rentals**: Vitec statuses ReadyForRent, TentativelyRented, Rented and ReservedNotForRental
   have no SRS status. Either the enum grows by `for_rent | rented` (additive) or rentals are
   dropped at the write path. Also: is "Booked" for sale? Needs a decision.
5. **Cottages** (fritidshus): `house` or `other`? Farms and foreign properties are `other`. Needs a
   decision.
6. **Several buildings**: Vitec's `Buildings[]` is a collection; the tables read the first
   building's figures. Right for homes; farms and commercial properties lose the rest to
   `provider_extras`. Needs a decision.
7. **Agents are tenant-wide** with an `offices[]` list, because Vitec users belong to several
   offices; the engine's licensing filter does not apply to them. Areas are office-scoped. Needs a
   decision.
8. **Brand**: keep `brand_id` on the office only, no brand datatype. Needs a decision.
9. **Projects**: out of the model for now, `ProjectId` in `provider_extras`. Needs a decision.
10. **Association overrides per estate**: ignored, the association's own texts are served. Needs a
    decision.
11. **Rate limits**: not documented by Vitec (open question 7). Ask Vitec, or set a conservative
    pace. Needs an answer before the adapter's fetch loop is tuned.
