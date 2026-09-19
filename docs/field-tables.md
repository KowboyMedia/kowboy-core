# Field tables: the universal model

**Three faces per record (Patric, 2026-09-19, question 44):** `raw` is the CRM payload as
received; `data` is the **universal** record: the CRM's fields copied and renamed onto the names
below, plus the ids that link records, with everything the tables do not name still present under
its mechanical snake_case name (the mirror of [data-model-reference.md](data-model-reference.md));
`display` holds the prepared strings the engine computes from `data` by the ledger entries in
`rules-ledger/`. The mapping from a CRM onto these names lives in that CRM's adapter. Nothing in
Core decides anything from a value: no status, no visibility, no flag, no tag, no slug. A site
reads `status.id` and decides for itself.

Approved by Patric on 2026-09-19 (chat, "41 yes" with the additions below; question 51 closed):
a thin universal model, about the fields every listing site shows and searches on, the whole
payload next to it, and a field promoted from the mirror into the tables only when a second
client type or a second CRM needs it.

Conventions:

- Names are snake_case English. A value a CRM sends as an enumeration with a label is copied as
  `{ "id", "name" }`, both as the CRM sends them; the site shows `name` and filters on `id`.
- A moment is ISO 8601 in UTC (`2026-09-01T08:00:00.000Z`), converted by the adapter from the
  CRM's clock. A date-only value stays a date. Numbers stay numbers. `null` where the CRM has no
  value, `[]` for a missing collection.
- The Vitec source column names the Advertising field (camelCase in the payload). "first
  building" means `buildings[0]`, copied by the adapter so a listing shows its sizes without
  digging; the whole `buildings[]` array is carried as well.
- Images: one address per image, at width 1920, on Kowboy's CDN, built by the adapter as
  `https://cdn-realestate.kowboy.se/r2/<customer id>/<record id>/<image id>_1920.<extension>`
  (strategy §12.28, question 50). `category` is the CRM's free-text category as the office
  configured it (Patric, 2026-09-19).

## Envelope (`schemas/item.v1.json`)

Unchanged: `datatype`, `connection_id`, `remote_id`, `office_id`, `seq`, `deleted`,
`schema_version`, `content_hash`, `remote_updated_at`, `raw`, `data` (SRS §3, §6; `raw` since
2026-09-18).

## Every datatype

| Field             | Type   | Meaning                                                                         |
| ----------------- | ------ | ------------------------------------------------------------------------------- |
| `id`              | string | Identity, the CRM's id (SRS §6.9)                                               |
| `display`         | object | Strings the engine prepares by the ledger (below); `sections` is a list         |
| `provider_extras` | object | Provider-only values, keyed by provider, never hashed (SRS §6.4); empty for now |

## Property

| Field                        | Type                       | Meaning                                               | Vitec source                                           |
| ---------------------------- | -------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `office_id`                  | string \| null             | The office; also the envelope's `office_id`           | `office.customerId`                                    |
| `agent_ids`                  | string[]                   | Primary agent first                                   | `primaryAgentId`, `secondaryAgentId`                   |
| `area_ids`                   | string[]                   | Zero or one, as the CRM assigns it                    | `address.area.id`                                      |
| `association_id`             | string \| null             | The housing cooperative                               | `extensions.housingCooperative.association.id`         |
| `project_id`                 | string \| null             | The project the property belongs to; sites group      | `projectId`                                            |
| `reference_number`           | string \| null             | The office's own object number                        | `referenceId`                                          |
| `status`                     | {id, name} \| null         | Sale status as the CRM sends it                       | `status`                                               |
| `type`                       | {id, name} \| null         | Class of property (house, apartment, farm, ...)       | `type`                                                 |
| `subtype`                    | {id, name} \| null         | Search type (detached house, townhouse, ...)          | `subtype`                                              |
| `tenure`                     | {id, name} \| null         | Form of ownership                                     | `tenure`                                               |
| `tags`                       | list                       | `{type: {id, name}, names: []}` per tag type          | `tags[]`                                               |
| `is_new_build`               | boolean \| null            | Marketed as new production                            | `marketing.isNewHome`                                  |
| `is_published`               | boolean \| null            | Marketed on the website                               | `marketing.isPublished`                                |
| `is_preview`                 | boolean \| null            | Preview mode on                                       | `marketing.isPreview`                                  |
| `published_at`               | moment \| null             | First published on the website                        | `marketing.publishedAt`                                |
| `address`                    | object                     | See below                                             | `address`                                              |
| `lat`, `lng`                 | number \| null             | WGS84                                                 | `address.wgs84Coordinate.latitude`, `.longitude`       |
| `heading`                    | string \| null             | Selling heading                                       | `sale.heading`                                         |
| `short_text`                 | string \| null             | Short selling text                                    | `sale.shortDescription`                                |
| `long_text`                  | string \| null             | Selling text                                          | `sale.description`                                     |
| `phrase`                     | string \| null             | Selling phrase                                        | `sale.phrase`                                          |
| `other_information`          | string \| null             | Other information                                     | `sale.otherInformation`                                |
| `possession_estimate`        | string \| null             | Possible possession, free text                        | `sale.possessionEstimation`                            |
| `possession_at`              | moment \| null             | Possession date                                       | `sale.possessionAt`                                    |
| `sold_at`                    | moment \| null             | Contract date                                         | `sale.contractDate`                                    |
| `assigned_at`                | moment \| null             | Assignment date                                       | `sale.assignmentDate`                                  |
| `price`                      | number \| null             | Asking price                                          | `price.startingPrice`                                  |
| `final_price`                | number \| null             | Sold price                                            | `price.finalPrice`                                     |
| `price_text`                 | string \| null             | The office's price wording (Utgångspris, ...)         | `price.text`                                           |
| `price_other_currency`       | {amount, currency} \| null | Asking price in another currency                      | `price.startingPriceInOtherCurrency`                   |
| `currency`                   | string \| null             | Currency of every amount                              | `currency`                                             |
| `fee`                        | object \| null             | `{amount, frequency, type, comment}`                  | `fees.recurring` (value, frequency, type, description) |
| `leasehold`                  | {fee, term} \| null        | Site leasehold (tomträtt)                             | `fees.leasehold`                                       |
| `lease`                      | object \| null             | `{fee, description, term, owner_name}` (arrende)      | `fees.lease`                                           |
| `living_space`               | number \| null             | m², first building                                    | `buildings[0].area.living`                             |
| `additional_space`           | number \| null             | m² (biarea), first building                           | `buildings[0].area.grossFloor`                         |
| `building_area`              | number \| null             | m², first building                                    | `buildings[0].area.building`                           |
| `area_description`           | string \| null             | Note on the areas, first building                     | `buildings[0].area.description`                        |
| `area_source`                | string \| null             | Source of the areas, first building                   | `buildings[0].area.source`                             |
| `rooms`                      | number \| null             | Number of rooms, first building                       | `buildings[0].numberOfRooms`                           |
| `bedrooms`                   | number \| null             | Bedrooms, first building                              | `buildings[0].bedrooms.count`                          |
| `bedrooms_max`               | number \| null             | Bedrooms the plan allows, first building              | `buildings[0].bedrooms.max`                            |
| `bathrooms`                  | number \| null             | Bathrooms, first building                             | `buildings[0].numberOfBathRooms`                       |
| `floor`                      | number \| null             | Floor, first building                                 | `buildings[0].floor.number`                            |
| `floors_total`               | number \| null             | Floors in the building, first building                | `buildings[0].floor.total`                             |
| `floor_description`          | string \| null             | Note on the floor, first building                     | `buildings[0].floor.description`                       |
| `elevator`                   | boolean \| null            | Elevator, null when not stated, first building        | `buildings[0].elevator.isAvailable`                    |
| `elevator_description`       | string \| null             | Note on the elevator, first building                  | `buildings[0].elevator.description`                    |
| `year_built`                 | number \| null             | Year built, first building                            | `buildings[0].yearBuilt.numeric`                       |
| `year_built_text`            | string \| null             | Year built as the office writes it (c:a 1990)         | `buildings[0].yearBuilt.text`                          |
| `year_built_description`     | string \| null             | Note on the year built                                | `buildings[0].yearBuilt.description`                   |
| `buildings`                  | list                       | Every building, see below                             | `buildings[]`                                          |
| `plot`                       | object \| null             | `{area, type, description}`, area in m²               | `exterior.plot` (size, type, description)              |
| `exterior_features`          | list                       | `{type: {id, name}, is_available, size, description}` | `exterior.entries[]`                                   |
| `other_buildings`            | string \| null             | Other buildings, free text                            | `exterior.buildingsDescription`                        |
| `building_permission`        | string \| null             | Building permit note                                  | `exterior.buildingPermission`                          |
| `operating_cost`             | number \| null             | Operating costs per year, total                       | `expenses.operation.sum`                               |
| `operating_costs`            | list                       | `{type: {id, name}, value}` per year                  | `expenses.operation.entries[]`                         |
| `operating_cost_description` | string \| null             | Note on the operating costs                           | `expenses.operation.description`                       |
| `household_size`             | number \| null             | Persons the operating costs assume                    | `expenses.operation.householdSize`                     |
| `images`                     | list                       | See below                                             | `images[]`                                             |
| `viewings`                   | list                       | See below                                             | `viewings[]`                                           |
| `viewing_settings`           | object                     | `{visible_limit, empty_text}`                         | `marketing.viewing`                                    |
| `bidding`                    | object                     | See below                                             | `bidding`                                              |
| `links`                      | list                       | `{name, category: {id, name}, url}`                   | `links[]`                                              |
| `surroundings`               | object                     | `{service, communication, area, parking, other}`      | `surroundings`                                         |

Kept under their mirrored names, not renamed: `taxation`, `pledges`, `enrollments`,
`electricity`, `inspection`, `extensions` (`housing_cooperative`, `condominium`,
`foreign_property`, `farm`, `commercial_property`, `premises`). A site that needs one of these
reads it there; the day two clients or two CRMs need it, it gets a row above.

### `address` (property, project)

| Field                      | Vitec source                     |
| -------------------------- | -------------------------------- |
| `street`                   | `address.streetAddress`          |
| `postal_code`              | `address.zipCode.value`          |
| `city`                     | `address.postalTown`             |
| `area_name`                | `address.area.name`              |
| `area_id`                  | `address.area.id`                |
| `municipality`             | `address.municipality`           |
| `country_code`             | `address.countryCode`            |
| `county_municipality_code` | `address.countyMunicipalityCode` |
| `directions`               | `address.directions`             |

### `buildings[]` (property)

The universal building. Other CRMs with one or several buildings map into the same shape
(Patric, 2026-09-19, question 45).

| Field                                                                                  | Vitec source                                                                                  |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `name`, `type`                                                                         | `name`, `type`                                                                                |
| `rooms`                                                                                | `numberOfRooms`                                                                               |
| `bedrooms`, `bedrooms_max`                                                             | `bedrooms.count`, `bedrooms.max`                                                              |
| `bathrooms`                                                                            | `numberOfBathRooms`                                                                           |
| `description`, `interior`, `other_information`                                         | the same names                                                                                |
| `year_built`, `year_built_text`, `year_built_description`                              | `yearBuilt.numeric`, `.text`, `.description`                                                  |
| `living_space`, `additional_space`, `building_area`, `area_description`, `area_source` | `area.living`, `.grossFloor`, `.building`, `.description`, `.source`                          |
| `floor`, `floors_total`, `floor_description`                                           | `floor.number`, `.total`, `.description`                                                      |
| `elevator`, `elevator_description`                                                     | `elevator.isAvailable`, `.description`                                                        |
| `ventilation`                                                                          | `{type, inspection}`                                                                          |
| `architecture`                                                                         | `{type: {id, name}, description}` per entry (facade, frame, roof, heating, kitchen type, ...) |
| `renovation`                                                                           | `renovation.description`                                                                      |
| `services`                                                                             | `{type: {id, name}, description}` per entry (TV, broadband)                                   |
| `room_list`                                                                            | `{name, description}` per room                                                                |
| `room_list_text`                                                                       | `compiledRoomList`                                                                            |
| `energy_declaration`                                                                   | `{consumption, class, status: {id, name}, performed_at}`                                      |
| `plot_description`                                                                     | `plot.description`                                                                            |
| `exterior_features`                                                                    | `{type: {id, name}, is_available, size, description}` per entry                               |
| `operating_cost`, `operating_costs`, `operating_cost_description`, `household_size`    | `expenses.operation.sum`, `.entries[]`, `.description`, `.householdSize`                      |
| `electricity`                                                                          | `{company, distributor, consumption}`                                                         |

### `images[]` (property, project, area; `image` on an agent)

| Field         | Vitec source                                     |
| ------------- | ------------------------------------------------ |
| `id`          | `id`                                             |
| `url`         | built on the CDN pattern above, width 1920       |
| `category`    | `category.name`, the office's free-text category |
| `name`        | `name`                                           |
| `description` | `description`                                    |
| `extension`   | `extension`                                      |
| `changed_at`  | `dataChangedAt`                                  |
| `order`       | position in the CRM's list, from 1               |

### `viewings[]` (property, project)

| Field                  | Vitec source                |
| ---------------------- | --------------------------- |
| `id`                   | `id`                        |
| `starts_at`, `ends_at` | `startsAt`, `endsAt`        |
| `comment`              | `comment`                   |
| `is_digital`           | `isDigital`                 |
| `self_registration`    | `isSelfRegistrationEnabled` |
| `is_project_viewing`   | `isProjectViewing`          |

### `bidding` (property)

| Field         | Vitec source                                                |
| ------------- | ----------------------------------------------------------- |
| `is_active`   | `bidding.isActive`                                          |
| `is_verified` | `bidding.isVerified`                                        |
| `bids`        | `{placed_at, amount, is_cancelled, alias}` per bid, as sent |

What the CRM sends is what the office allows the website to show: no bids, the highest only, or
the history. Core copies; the site decides what to render (Patric, 2026-09-19).

## Project

| Field                                                                         | Type / meaning                        | Vitec source                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| `office_id`, `agent_ids`, `area_ids`                                          | as property                           | as property                                                               |
| `name`                                                                        | string \| null                        | `name`                                                                    |
| `status`                                                                      | {id, name} \| null                    | `status`                                                                  |
| `address`, `lat`, `lng`, `surroundings`                                       | as property                           | as property                                                               |
| `heading`, `short_text`, `long_text`, `phrase`, `other_information`           | as property                           | `sale.*`                                                                  |
| `sale_starts_at`                                                              | moment \| null                        | `sale.startsAt`                                                           |
| `possession_estimate`                                                         | string \| null                        | `sale.possessionEstimation`                                               |
| `images`, `viewings`, `viewing_settings`, `links`                             | as property                           | as property                                                               |
| `is_new_build`, `is_published`, `is_preview`, `published_at`                  | as property                           | `marketing.*`                                                             |
| `currency`                                                                    | string \| null                        | `currency`                                                                |
| `price_range`, `fee_range`, `living_space_range`, `rooms_range`, `plot_range` | `{min, max}` over the project's homes | `estates.price`, `.monthlyFee`, `.livingSpace`, `.numberOfRooms`, `.plot` |
| `producer`                                                                    | string \| null                        | `producer.name`                                                           |

A project does not list its homes; each property names its project in `project_id`, and a site
lists a project's homes by that id and keeps them out of its other lists (Patric, 2026-09-19).

## Agent

| Field                                      | Type / meaning                                                                             | Vitec source                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `office_ids`                               | string[]                                                                                   | `offices[].customerId`                                                                  |
| `name`, `title`, `category`, `description` | strings                                                                                    | the same names                                                                          |
| `email`                                    | string \| null                                                                             | `emailAddress`                                                                          |
| `languages`                                | string[]                                                                                   | `spokenLanguages`                                                                       |
| `phones`                                   | `{mobile: {number, display}, public: {number, display}}`, `number` in international format | `telephone.cell`, `telephone.public` (`msisdn`, `display`)                              |
| `image`                                    | image object \| null (CDN address under the first office)                                  | `image`                                                                                 |
| `is_visible_in_staff_list`                 | boolean \| null                                                                            | `isVisibleInStaffList`                                                                  |
| `offices`                                  | `{office_id, order, is_visible_in_staff_list, phone: {number, display}}` per office        | `offices[]` (`customerId`, `orderNumber`, `isVisibleInStaffList`, `telephone.personal`) |
| `reviews`                                  | `{text, author}` per review, latest first                                                  | `reviews[]` (`text`, `authorName`)                                                      |

## Office

| Field                 | Type / meaning                | Vitec source                                   |
| --------------------- | ----------------------------- | ---------------------------------------------- |
| `id`                  | the customer id (`M30011`)    | `customerId`                                   |
| `brand_id`            | string \| null                | `brandId`                                      |
| `name`                | string \| null                | `name`                                         |
| `address`             | `{street, postal_code, city}` | `streetAddress`, `zipCode.value`, `postalTown` |
| `phone`               | `{number, display}`           | `telephone.switch`                             |
| `email`               | string \| null                | `emailAddress`                                 |
| `seat`, `description` | strings                       | the same names                                 |
| `lat`, `lng`          | number \| null                | `coordinate.latitude`, `.longitude`            |

## Area

| Field                      | Type / meaning                                    | Vitec source             |
| -------------------------- | ------------------------------------------------- | ------------------------ |
| `name`                     | string \| null                                    | `name`                   |
| `county_municipality_code` | string \| null                                    | `countyMunicipalityCode` |
| `polygon`                  | GeoJSON MultiPolygon coordinates, as sent         | `coordinates`            |
| `office_id`                | string \| null, informational; areas are loose    | `office.customerId`      |
| `surroundings`             | as property                                       | `surroundings`           |
| `images`                   | as property (CDN address under the area's office) | `images[]`               |

## Association

| Field                                                                                          | Vitec source                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `corporate_number`, `organizational_form`, `email`, `home_page`, `genuine_association` | the same names, snake_case                                                                                                                                                                          |
| `number_of_apartments`, `number_of_rental_apartments`, `number_of_premises`                    | the same names                                                                                                                                                                                      |
| `descriptions`                                                                                 | `{general_about_association, renovations, parking, tv_and_broadband, courtyard, shared_spaces, insurance, other}`                                                                                   |
| `economy`                                                                                      | `{monthly_fee_information, finances, subletting_policy, the_association_own_the_ground, transfer_fee, transfer_fee_paid_by, pledge_fee, allow_legal_person_as_buyer, allows_shared_ownership_info}` |
| `contact`                                                                                      | `{name, mobile, phone, email}` from `publicContact`                                                                                                                                                 |

## `display`

Prepared strings, computed by the engine from the fields above by the entries in `rules-ledger/`
(one entry per string, with the format and examples). The engine reads universal names only and
never decides from a value: a string is there when its inputs are, and absent otherwise. Sites
may show, ignore or replace any of them.

| Key                                                                      | Datatype                                   | Ledger       |
| ------------------------------------------------------------------------ | ------------------------------------------ | ------------ |
| `price`, `final_price`, `price_other_currency`                           | property                                   | R-001        |
| `price_range`, `fee_range`                                               | project                                    | R-001, R-014 |
| `living_space`, `additional_space`, `area`, `plot_area`, `building_area` | property                                   | R-002        |
| `living_space_range`, `plot_range`                                       | project                                    | R-002, R-014 |
| `rooms`, `bedrooms`, `rooms_and_bedrooms`                                | property                                   | R-003        |
| `rooms_range`                                                            | project                                    | R-003, R-014 |
| `fee`, `fee_comment`                                                     | property                                   | R-004        |
| `floor`                                                                  | property                                   | R-005        |
| `elevator`                                                               | property                                   | R-006        |
| `year_built`                                                             | property                                   | R-007        |
| `highest_bid`                                                            | property                                   | R-008        |
| `operating_cost`                                                         | property                                   | R-009        |
| `lease`, `leasehold`                                                     | property                                   | R-010        |
| `energy_declaration`                                                     | property                                   | R-011        |
| `address_line`, `location`                                               | property, project, office (`address_line`) | R-012        |
| `sections`                                                               | property                                   | R-013        |
