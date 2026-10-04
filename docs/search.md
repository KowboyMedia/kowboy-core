# Search by place, and the list blocks in the plugin

**Status:** approved 2026-10-04: Patric answered 133 with a (a home is in every area whose
outline holds it) and let Default 134 stand, and added two rules: the links are recomputed only
when a home's point or an area's outline changed, which is rare, and every agent filter checks
both of a home's agents. All three sessions below are built, 2026-10-04: the query and the data
(plugin 0.5.0, theme 1.0.18, tests 1 and 2), the blocks in the plugin with the pick control and
the pick endpoint (plugin 0.5.1, theme 1.1.0, test 4) and the search box with pills (plugin
0.5.2, theme 1.1.1, tests 3 and 5); what remains is the deploy to the staging site, the plugin
before the theme, which waits for the site's login (question 121). **The ask** (Patric, 2026-10-04, "discuss before building"): the search
method accepts an LKF code or the significant part of one (the L part for a län, the LK part for a
kommun); a free text search matches the beginning of a street address, of an area name or of a
kommun name; the WordPress property list and agent list are blocks that live in the plugin, not
in the theme, with settings for "show only from these agents, areas, offices", "allow area
selection" and "also allow kommun and län selection"; the search box is a combo box that offers
only the areas, kommuner and län that have published homes; areas are matched by their
geographical polygon; a chosen place becomes a pill, and clicking the pill removes it; a search
with no pill runs the free text; the agent list gets the same with "these offices only"; and all
of it fast, both the filling of the box and the search. The recommendation is in "The
recommendation" below; the reasoning is in the rest of this file, so chat can point to it. A
second agent reviewed this file on 2026-10-04 and its findings are worked in.

**Two readings of the ask, stated so they can be refused.** The LKF lookup table "being built
separately" is read as the plugin's kommun table finished the same morning
(`includes/municipalities.php`, 290 kommuner by code); this design adds the 21 län to it. "Do the
same with agent list (these offices only)" is read as one setting on the agent list block, "show
only from these offices", with no visitor-facing box on the agent list.

## Terms

- **The CRM** is the brokerage's customer system that holds its homes, offices, agents and
  areas; Vitec Express today, Mspecs later. **Core** reads the CRM and keeps one copy of every
  record in one shape. **A site** is one website with Core's client in it, a WordPress install
  with the plugin or a Lovable site with the kit; a site **pulls** its records from Core and
  renders only from its own copy.
- **The plugin** is Core's WordPress client, `clients/wordpress/core-client/`. It keeps the local
  copy (one WordPress post per record, the record's data in the post, and one **index table**
  with a row per record carrying the columns the lists search on), and it has **the query
  function**, `core_client_query()` in `includes/query.php`: one parameter set in, one page of
  records out. The archive page, the shortcode, the reload endpoint and every block call it with
  the same parameter set. **The search method** of the ask is this function.
- **A set** is the files that give the records their look: one file per card, list wrapper and
  page, which the plugin renders through. **The theme** "Kowboy 2026"
  (`clients/wordpress/themes/kowboy-2026/`) is the default set, with the design's sections as
  **blocks**, the pieces an editor places on a page in WordPress's editor. The plugin finds a
  view in the theme first, so a theme or a set can replace any file.
- **An LKF code** is Statistics Sweden's code for a place: two digits for the **län** (county,
  the L part), two more for the **kommun** (municipality, the LK part, four digits together) and
  two more for the **församling** (parish, six digits). Vitec sends the four-digit LK code on
  every home and every area (`county_municipality_code`); the fake CRM of the test suite sends
  six digits.
- **A polygon** is an area's outline on the map, a list of corner points. Vitec sends every
  area's outline (`polygon`, in the GeoJSON shape: one or more outlines, each with an outer ring
  and optional holes, each point as longitude, latitude), and every home's point (`lat`, `lng`).
- **A combo box** is a text field with a list of suggestions that narrows as one types; **a
  pill** is a small removable label that shows one chosen place.

## What the data already carries, and what is missing

What is already on every site, in the stored records (`docs/field-tables.md`):

- **A home:** its point (`lat`, `lng`), its street, its postal town (`address.city`, "Limhamn"),
  its area as the CRM assigned it (`address.area_id`, `address.area_name`; zero or one area),
  the kommun name as text (`address.municipality`, "Malmö") and the kommun's code
  (`address.county_municipality_code`, "1280"). The three Vitec golden homes carry all of these.
- **An area:** its name, its outline (`polygon`; the golden area Dalhem is one outline of 28
  points) and its kommun code (`county_municipality_code`, "1283").
- **The kommun table** in the plugin: 290 names by the first four digits of a code.

What is missing, all on the site's side:

- The index table has no code, no point, no outline bounds and no many-to-many link between
  homes and areas, so today a home belongs to one area (the CRM's) and nothing searches by code
  or by outline. An area's outline sits only inside its stored record (the JSON in the post).
- A **län table**: 21 names by the first two digits (Statistics Sweden's list, the source of the
  kommun table), so a län can be shown by name and typed by name.
- The free text search today matches anywhere in the area name, the town or the street
  (`LIKE '%word%'`); the ask wants the beginning of the word.
- The fake CRM the test suite runs on sends no outline and no points (`adapters/fake-polling`
  maps `polygon` to null, `adapters/fake-webhook` nulls `lat` and `lng`), so the suite cannot
  prove outline matching until the fake area gets an outline and the fake homes get points.

## Where it lives: the plugin, not Core and not the theme

- **Not Core.** Core applies no logic to CRM data and knows no site; a site renders from its own
  copy and keeps serving when Core is down (strategy, AGENTS.md "The seam"). The Concept also
  says "all data logic lives in Core; clients are templates plus a sync loop", and the two meet
  where they met for the slugs and the staff-list rule: Core carries every value untouched (the
  point, the outline, the code, the CRM's area), and which homes a page lists, and which area a
  home counts in, is the site's reading of its stored records. Core changes nothing here. A
  Lovable site carries the same reading a second time, in the kit, from the same stored fields,
  as it does the slug rule.
- **Not the theme.** The ask says it: a site that installs the plugin has the list blocks, their
  settings and the search without the Kowboy 2026 theme. The theme keeps the look (the views)
  and its own design options.
- **Matching by outline runs when a record is written**, never when a visitor searches. The
  sync writes a home seldom (a change in the CRM); a visitor searches often. So the plugin
  computes a home's areas once, at the write, stores them in a small table, and a search only
  reads that table. A plugin update recomputes everything from the stored records, so a changed
  rule reaches every home without CRM traffic (AGENTS.md: anything derived is patchable).

## The query function: the new parameters

Every parameter is read in `core_client_query()` alone, as today, so the archive page, the
shortcode `[core_list]`, the reload endpoint `/wp-json/core/v1/list` and the blocks get all of
them at once. New or changed:

| Parameter                    | Meaning                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lkf`                        | One or more codes of exactly two, four or six digits (a län, a kommun, a parish); anything else is ignored. Each matches every home whose stored code **begins with** it, so `12` is all of Skåne, `1280` is Malmö, and a six-digit code works the day a CRM sends six digits (Vitec sends four today).                                                             |
| `areas`                      | One or more area ids the visitor chose. A home matches when the link table says it belongs to the area (the CRM's assignment or the outline, below).                                                                                                                                                                                                                |
| **the place group**          | `areas` and `lkf` together are "where": a home matches when it is in **any** of the chosen places (a visitor who picks Dalhem and Malmö wants both). Everything else is "and".                                                                                                                                                                                      |
| `q`                          | The free text. A home matches when its street, its area name or its postal town **begins with** the words, or when the words begin the name of a kommun or a län, looked up in the plugin's two tables and turned into codes (`q=Malm` finds the streets, areas and towns starting with "Malm" and every home in Malmö kommun). "Beginning" is the ask's own word.  |
| `area`                       | Today the free text, anywhere in the word. It stays for one release as another name for `q`, so a shortcode or a page that uses it keeps working, and goes in the release after (the expand and contract rule of strategy §6, applied to the plugin's own parameter set).                                                                                           |
| `agent`, `office`, `area_id` | The restrictions a block or a page sets ("show only from these"). They exist as single values today and take lists: any of these agents, any of these offices, any of these areas (through the same link table). They narrow the result together with the place group: a block restricted to `area_id=A,B` with a visitor's `areas=B,C` lists the homes in B alone. |

Unchanged: `status`, `type`, `tenure`, the price, size and room bounds, `project`, `association`,
`include_project_homes`, `include_hidden`, `sort`, `per_page`, `page`.

**The index table gains eight columns**, copied from the stored record at every write like the
others: on a home `county_municipality_code` (the code as sent, up to six characters), `lat` and
`lng`; on an area the four bounds of its outline, `min_lat`, `max_lat`, `min_lng`, `max_lng`,
so the matching below finds its candidates with one small query and never opens an outline that
cannot hold the point, and `polygon_hash`, one short value that changes when the outline does,
so a write knows whether to relink without comparing outlines (Patric's rule: only on a change). A home without a code is simply never found by a code; the link table
still finds it by area. **One key** on (datatype, code) serves the prefix search; the free text's
three columns are compared in one scan, which on the sites this serves (hundreds to a few
thousand homes) is under a millisecond, and a key is added when a measurement asks for one.

**One new link table**, `wp_core_property_areas` (home post id, area id), with a key on the
area id, holds every area a home belongs to: the CRM's assignment and every outline its point
falls in. A home here is a property or a project record (both have a point and an address);
the query's `entity` keeps them apart as before. The existing `area_id` column keeps the CRM's own choice, so the table can always be
rebuilt from it and the outlines.

## Matching a home to areas by outline

- **The test** is the standard point-in-polygon test (ray casting): for each outline of the
  area, the point is inside when it is inside the outer ring and inside none of the holes. It is
  about forty lines of PHP in the plugin, with its own tests against hand-drawn shapes (a
  square, a square with a hole, two separate outlines, a point on the edge), run through the
  test driver without a CRM.
- **When a home is written** (a sync write, a rebuild, a plugin update): one query asks the index
  for the areas whose bounds hold the home's point, usually none to a handful; only those areas'
  outlines are read from their records and tested; the home's rows in the link table are
  replaced: the CRM's area plus every match. The golden outline has 28 points; even a hundred
  candidate outlines of a hundred points each are ten thousand edge tests, a few milliseconds.
- **When an area is written** (a new outline or a redrawn one): the rows of that area are
  replaced from both sources: the homes whose `area_id` names it, and every home whose point
  falls in the new outline, one pass over the homes' points from the index, bounds first. Ten
  thousand homes against one outline is well under a second, and an area changes rarely.
- **A plugin update** rebuilds the link table for every home. The reindex that rewrites the
  slugs and the search columns runs today in the first request after the update; the link
  table's rebuild runs as a scheduled action of Action Scheduler, which the plugin bundles, in
  batches of homes, so a shared host's time limit on one request never cuts it short, and the
  sync's own writes keep the table current meanwhile.
- **A home without a point** belongs to the CRM's area only. **An area without an outline**
  holds the homes the CRM assigned to it only. Nothing else changes.
- **Overlapping outlines** are the one product question (133): with the recommended answer a
  home inside two outlines is in both areas, and the area page and the area card count it in
  both; with the other answer the CRM's choice stands and the outline only fills a gap.
- **Why not the database's own spatial functions.** MariaDB and MySQL can hold a polygon column
  and answer "is this point inside" (`ST_Contains`), the market-leading way for maps at scale.
  Here it loses: WordPress's table tool (`dbDelta`) cannot create geometry columns or spatial
  keys reliably, hosts differ in what they allow, and the work happens at a write, not at a
  search, so the database's speed buys nothing a visitor would notice. A geometry library
  (`brick/geo`, `geoPHP`) would be a new runtime dependency for forty lines. The small PHP
  test it is, and the reason is this paragraph.

## The blocks in the plugin

**Two blocks**, registered by the plugin with Swedish titles like every text an editor sees in
the lists: **"Bostäder"** (the property list) and **"Mäklare"** (the agent list). They render
through the one list function and the views, so the look is the theme's or the set's, and a
site with another set overrides `core/list-property.php` and the cards as it does today.

The property list's settings, in the editor's side panel:

| Setting                      | What it does                                                                                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rubrik, Ingress              | The title and the lead over the list (today the theme block's).                                                                                                                                                                        |
| Vilka bostäder               | Till salu och kommande, Till salu, Kommande, Sålda (the site's status lists, as today).                                                                                                                                                |
| Antal per sida, Statusflikar | As today.                                                                                                                                                                                                                              |
| Filter                       | The price, size and rooms form, as today (the theme's search card draws it).                                                                                                                                                           |
| Platssök                     | Inget · Områden · Områden, kommuner och län. "Områden" is the ask's "allow area selection": the box offers areas only. The third adds kommuner and län. One setting instead of two switches, so no setting combination is meaningless. |
| Visa bara från dessa mäklare | A pick of agents by name; the list holds only their homes.                                                                                                                                                                             |
| Visa bara från dessa områden | A pick of areas by name; the list holds only homes in them, by the link table.                                                                                                                                                         |
| Visa bara från dessa kontor  | A pick of offices by name; the list holds only their homes.                                                                                                                                                                            |

The agent list's settings: Rubrik, Ingress, and **Visa bara från dessa kontor**, a pick of
offices; the list holds the agents of those offices, in the CRM's order as today.

- **The picks** use WordPress's own token field (`FormTokenField`, the editor's standard
  multi-pick with suggestions and removable labels). It works on the labels, so every label is
  unique: an area reads "Dalhem · Helsingborg" (its kommun), an agent "Erik Egen · Kontoret på
  Söder" (an office), an office "Kontoret på Söder · Helsingborg" (its town). One small plugin
  endpoint, open to editors only, lists the site's agents, offices or areas as label and id,
  every record, listed or hidden, since the editor chooses. The block stores ids, so a renamed
  office keeps working.
- **The editor side moves into the plugin.** The theme's `assets/editor.js` builds every block's
  side panel from the `control` keys in `block.json` and previews the block as the server renders
  it (question 103, no bloat). That builder becomes the plugin's, under one script handle, with
  one new control for the picks. The names of the blocks it serves come from one list that the
  plugin and the theme both append to (an inline script before the handle), and the theme's
  `block.json` files name the plugin's handle as their editor script. With the plugin inactive
  the theme's blocks have no panel, which is right: they render nothing then either.
- **The theme's two list blocks become thin wrappers.** `kowboy/property-list` keeps its one
  design option (the background) and `kowboy/agents` its text card with the button; each is
  registered with the plugin's list settings merged into its own (`register_block_type` takes
  the whole attribute set, with the `control` and `label` keys, which reach the editor as today)
  and calls the plugin's one render function. The demo pages keep their block names and need no
  change; an editor who wants a plain list on another theme uses the plugin's block.
- **The shortcode** `[core_list]` takes every new parameter for free, as it is the same
  parameter set.

## The search box: the combo box with pills

- **One plugin function draws it**, `core_client_place_search($params)`: the markup of the
  field, the pills and the places as data. A set's list wrapper calls it where it wants the box;
  the theme's search card calls it in place of today's "Område" text field. So the box is the
  plugin's, and every set that calls the function has it.
- **The suggestions** come in three groups, **Områden**, **Kommuner** and **Län** (the last two
  only when the block's "Platssök" allows them). An area reads "Dalhem · Helsingborg".
- **It offers only places that would give a result:** the areas, kommuner and län that have at
  least one home matching the block's own setting (its statuses and its "show only from these").
  The ask says "where there are existing published properties"; this is the stricter reading: a
  list of homes for sale never offers a kommun whose only homes are sold. The status tabs narrow
  within the block's statuses, so the list fits every tab. This is one query over the index (a
  group count over the filtered rows), run when the page renders and written into the box's
  markup as data, so the box is full the moment the page shows and no second request is made. On
  the sites this serves that query is a few milliseconds; it is not cached until a measurement
  says otherwise, the same stance as decision 124 (the list's cost is WordPress's start, not the
  query).
- **Typing** narrows the suggestions in the browser, over at most a few hundred entries, so it
  is instant. **Choosing** one adds a pill under the field and runs the search at once. **Clicking
  a pill** removes it and runs the search again. Pills mean "any of these places".
- **Typing without choosing** and pressing Sök or Enter searches the words as free text, by the
  rule of `q` above. With pills present the words narrow further (Default 134): the pills say
  where, the words say which street or name. With no pill the words search alone, as the ask says.
  Built: the form around the box sends its fields to the list on the page when there is one (the
  cards reload, the address is written, the page stays), and loads the page with the fields in
  its address otherwise; a form inside a list's own filters is left to the set's list script.
- **The state goes into the page address** (`?areas=…&lkf=…&q=…`): the script writes every
  change there (`history.replaceState`, new behaviour; today only the Till salu card's full
  submit reaches the address, and the tabs and the in-list form reload the cards without it), so
  a search can be shared, a page cache can hold it, and the back button works. The cards reload
  through the existing endpoint with the same parameters, as the tabs do, and the archive page
  and the block read the three new parameters from the address on the first render, as they
  read the price and size today.
- **Keyboard and screen readers** follow the standard combo box pattern (the WAI-ARIA combobox:
  arrow keys move, Enter chooses, Escape closes, the field names its list).
- **The plugin's own small script and stylesheet** draw the box, about two hundred lines, loaded
  only on a page that has a list with place search, and the theme restyles it with its own
  stylesheet. Not a library: Tom Select is the market-leading multi-pick combo box, but the box
  must work both inside the shadow root the plugin opens around the archive page and the
  shortcode by default and on the open page where the theme's blocks render, the option list is
  small, so a library's filtering and virtual scrolling buy nothing, and the look must be the
  theme's. That is the stated reason for not taking the library; the decision is recorded in
  `docs/decisions.md` (2026-10-04).
- **Built as** (2026-10-04): `includes/place-search.php` holds the places query
  (`core_client_places($params)`, one group count per group through the list's own condition,
  `core_client_query_condition()`, without the visitor's choices and the paging), the pills from
  the address (`core_client_place_pills`) and the one render function; the field is `q`, the
  pills write two hidden fields, `areas` and `lkf`, so a plain submit and the script's reload
  send the same parameters. The script and the stylesheet (`assets/place-search.js`, `.css`) are
  enqueued only in a request that drew a box, and `core_client_wrap` links the stylesheet inside
  every shadow root of such a request. The script tells the list on the page with one event,
  `core-list:params` on the `[data-list]` element nearest the box, else the first on the page,
  its detail the form's fields; the set's list script merges the detail into its parameters and
  reloads from the first page. The theme's search card (`parts/search-form.php`) calls the
  function and keeps its text field when the plugin is older than 0.5.2; the hero block's setting
  "Platssök" (none, areas, or areas with kommuner and län, the last by default) and the archive
  page (places) choose the groups.
- **The Till salu page's search card** keeps its three choices (max price, minimum size,
  minimum rooms) and swaps the "Område" text field for this box.

## Performance, in numbers

| Moment                   | Work                                                                                                  | Expected cost                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A visitor searches       | One count and one page query over the index, the code by its key, and a join on the link table's keys | A few milliseconds on ten thousand homes; the page's cost stays WordPress's start (decision 124) |
| The page renders the box | One group count over the block's filtered rows                                                        | A few milliseconds; written into the markup, no second request                                   |
| The sync writes a home   | One query for the areas whose bounds hold the point, the full test on those few, one table replace    | Under ten milliseconds                                                                           |
| The sync writes an area  | One pass over the homes' points, bounds first, one table replace                                      | Well under a second for ten thousand homes                                                       |
| A plugin update          | The link table rebuilt in batches by a scheduled action                                               | Minutes at most, in the background, never in a visitor's request                                 |

Nothing in the visitor's path computes geometry, and nothing new is cached.

## Tests, all automatic

In `clients/wordpress/templates.test.ts` and the sync suite, against the real WordPress and
database the suites already drive, plus one browser journey:

1. The query answers `lkf` by prefix (two and four digits; a three-digit value is ignored), `q`
   by the beginning of a street, an area name, a town, a kommun name and a län name, `area` as
   another name for `q`, the place group as "any of", and the restrictions `agent`, `office` and
   `area_id` as lists, combined with status and price.
2. The outline test on hand-drawn shapes through the test driver; then, with the fake CRM's area
   given an outline and its homes points (the fake adapter maps them; the suite's own fixtures
   draw them, both agent-owned): a home inside an outline is linked, inside a hole is not, outside is not;
   a home the CRM put in one area and whose point lies in another is in both (133 a) or in the
   CRM's only (133 b); a redrawn outline re-links; a plugin update's scheduled rebuild fills the
   table.
3. The box offers only places with a matching home under the block's statuses and restrictions,
   in three groups with the kommun after an area's name.
4. The plugin alone (the theme off, the fixture set on) registers both blocks, renders them
   through the set's views, applies the restrictions and serves the pick endpoint to an editor
   and not to a visitor; the theme's wrappers keep the background and the text card, and the demo
   pages render.
5. One browser journey (Playwright, `npm run test:journeys:wordpress`, its own config
   `clients/wordpress/playwright.config.ts`; the site is `test/journey-site.ts`, the real
   WordPress with the suite's records through a real Core, run from `dist` after `npm run build`
   as the admin area's journeys are): on the Till salu page, type, choose a suggestion by mouse
   and by keyboard, the pill appears and the cards reload, the address carries the choice,
   clicking the pill or Backspace removes it, words with and without a pill search as Default 134
   says, and the page drawn again from the address shows the pill, the words and the cards.

Acceptance: AC 20's search half names these tests; the report is regenerated.

## Order of building, three sessions

1. **The query and the data** (plugin 0.5.0): the eight columns and the key, the link table, the
   län table, the outline test, the new parameters with `area` kept as a name for `q`, the
   scheduled rebuild, the fake CRM's outline and points, tests 1 and 2. The theme's search form
   sends `q`. Nothing visible changes but the free text's rule.
2. **The blocks** (plugin 0.5.x, theme 1.1.0): the editor builder moves into the plugin with the
   pick control and the pick endpoint, the two blocks, the theme's wrappers, test 4.
3. **The search box** (plugin 0.5.x, theme 1.1.x): the one render function, the places data, the
   script and stylesheet, the pills and the address, the Till salu card, tests 3 and 5, then the
   deploy to the staging site.

## Not asked for, cheap to add

- A block restriction by kommun or län ("show only from Skåne"): the same `lkf` parameter, one
  more setting. Raised as an opportunity; built on Patric's word.
- The same place search on a Lovable site: the kit has no lists today; when a Lovable site needs
  them, the same stored fields and the same rules apply, in the Supabase function.

## The recommendation

- Build it in the plugin, as above: the query function takes `lkf`, `areas`, `q` and the list
  restrictions; a home's areas are computed at the write by the outline test, from the areas
  whose bounds hold its point, and stored in one link table; two blocks with the settings of the
  ask live in the plugin and render through the theme's views; the search box is the plugin's
  own small combo box with pills, drawn by one plugin function and fed from the page's own
  markup.
- Decide 133 (a home inside two outlines is in both areas, recommended) and confirm or refuse
  Default 134 (free text narrows the pills), then the three sessions above run in order.
