# Search by place, and the list blocks in the plugin

**Status:** proposed 2026-10-04, waiting on questions 133 and 134 in `docs/open-questions.md`.
Nothing here is built. **The ask** (Patric, 2026-10-04, "discuss before building"): the search
method accepts an LKF code or the significant part of one (the L part for a län, the LK part for a
kommun); a free text search matches the beginning of a street address, of an area name or of a
kommun name; the WordPress property list and agent list are blocks that live in the plugin, not
in the theme, with settings for "show only from these agents, areas, offices", "allow area
selection" and "also allow kommun and län selection"; the search box is a combo box that offers
only the areas, kommuner and län that have published homes; areas are matched by their
geographical polygon; a chosen place becomes a pill, and clicking the pill removes it; a search
with no pill runs the free text; and all of it fast, both the filling of the box and the search.
The recommendation is in "The recommendation" below; the reasoning is in the rest of this file,
so chat can point to it. A second agent reviewed this file on 2026-10-04 and its findings are
worked in.

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
- **The theme** "Kowboy 2026" (`clients/wordpress/themes/kowboy-2026/`) is the default look: the
  **views** (one file per card, list wrapper and page under `core/`) and the design's sections as
  **blocks**, the pieces an editor places on a page in WordPress's editor. The plugin finds a view
  in the theme first, so a theme or a set can replace any file.
- **An LKF code** is Statistics Sweden's code for a place: two digits for the **län** (county,
  the L part), two more for the **kommun** (municipality, the LK part, four digits together) and
  two more for the **församling** (parish, six digits). Vitec sends the four-digit LK code on
  every home and every area (`county_municipality_code`); the plugin already carries the 290
  kommuner by code (`includes/municipalities.php`, from Statistics Sweden's 2026 list).
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

- The index table has no code, no point and no many-to-many link between homes and areas, so
  today a home belongs to one area (the CRM's) and nothing searches by code or by outline.
- A **län table**: 21 names by the first two digits (Statistics Sweden's list, the source of the
  kommun table), so a län can be shown by name and typed by name.
- The free text search today matches anywhere in the area name, the town or the street
  (`LIKE '%word%'`), which cannot use an index; the ask wants the beginning of the word.

## Where it lives: the plugin, not Core and not the theme

- **Not Core.** Core applies no logic to CRM data and knows no site; a site renders from its own
  copy and keeps serving when Core is down (strategy, AGENTS.md "The seam"). Which homes a page
  lists, and which area a home counts in, is the site's reading of its stored records, like the
  slug and the staff-list rule. Core changes nothing here. A Lovable site gets the same rules
  later, in the kit, from the same stored fields.
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

| Parameter                    | Meaning                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lkf`                        | One or more codes of two, four or six digits (a län, a kommun, a parish). Each matches every home whose stored code **begins with** it, so `12` is all of Skåne, `1280` is Malmö, and a six-digit code works the day a CRM sends six digits (Vitec sends four today).                                                           |
| `area`                       | One or more area ids the visitor chose. A home matches when the link table says it belongs to the area (the CRM's assignment or the outline, below). Today `area` is the free text parameter; that meaning moves to `q`.                                                                                                        |
| **the place group**          | `area` and `lkf` together are "where": a home matches when it is in **any** of the chosen places (a visitor who picks Dalhem and Malmö wants both). Everything else is "and".                                                                                                                                                   |
| `q`                          | The free text. A home matches when its street, its area name or its postal town **begins with** the words, or when the words begin the name of a kommun or a län, looked up in the plugin's two tables and turned into codes (`q=Malm` finds the streets, areas and towns starting with "Malm" and every home in Malmö kommun). |
| `agent`, `office`, `area_id` | The restrictions a block or a page sets ("show only from these"). They exist as single values today and take lists: any of these agents, any of these offices, any of these areas (through the same link table). They narrow the result together with the place group.                                                          |

Unchanged: `status`, `type`, `tenure`, the price, size and room bounds, `project`, `association`,
`include_project_homes`, `include_hidden`, `sort`, `per_page`, `page`.

**The index table gains three columns**, copied from the stored record at every write like the
others: `county_municipality_code` (the code as sent, up to six characters), `lat` and `lng`. A
home without a code takes the code of the area the CRM assigned it, when that area is on the
site (default). **Three keys** make the prefix searches cheap: (datatype, code), (datatype,
street), (datatype, area name); a "begins with" comparison uses a key, which is why the free
text changes from "anywhere" to "beginning".

**One new link table**, `wp_core_property_areas` (home post id, area id), with a key on the
area id, holds every area a home belongs to: the CRM's assignment and every outline its point
falls in. The existing `area_id` column keeps the CRM's own choice, so the table can always be
rebuilt from it and the outlines.

## Matching a home to areas by outline

- **The test** is the standard point-in-polygon test (ray casting): for each outline of the
  area, the point is inside when it is inside the outer ring and inside none of the holes. An
  outline's bounding box is checked first, which rejects nearly every area in four comparisons.
  It is about forty lines of PHP in the plugin, with its own tests against hand-drawn shapes
  (a square, a square with a hole, two separate outlines, a point on the edge).
- **When a home is written** (a sync write, a rebuild, a plugin update): its point is tested
  against every area outline the site holds, and its rows in the link table are replaced: the
  CRM's area plus every match. The golden outline has 28 points; a site with 300 areas of 100
  points each costs at most 30,000 edge tests for one home, a few milliseconds, and the bounding
  boxes cut that to a handful of areas.
- **When an area is written** (a new outline or a redrawn one): the rows of that area are
  replaced from both sources: the homes whose `area_id` names it, and every home whose point
  falls in the new outline, one pass over the homes' points from the index. Ten thousand homes
  against one outline is well under a second, and an area changes rarely.
- **A plugin update** rebuilds the whole link table in the reindex that already rewrites every
  slug and search column, so a changed rule reaches every home.
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
site with another theme overrides `core/list-property.php` and the cards as it does today.

The property list's settings, in the editor's side panel:

| Setting                      | What it does                                                                                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rubrik, Ingress              | The title and the lead over the list (today the theme block's).                                                                                                                                                                        |
| Vilka bostäder               | Till salu och kommande, Till salu, Kommande, Sålda (the site's status lists, as today).                                                                                                                                                |
| Antal per sida, Statusflikar | As today.                                                                                                                                                                                                                              |
| Filter                       | The price, size and rooms form, as today (the theme's search card draws it).                                                                                                                                                           |
| Platssök                     | Inget · Områden · Områden, kommuner och län. "Områden" is the ask's "allow area selection": the box offers areas only. The third adds kommuner and län. One setting instead of two switches, so no setting combination is meaningless. |
| Visa bara från dessa mäklare | A pick of agents by name; the list holds only their homes.                                                                                                                                                                             |
| Visa bara från dessa områden | A pick of areas by name (with the kommun after the name, so two areas called Centrum are told apart); the list holds only homes in them, by the link table.                                                                            |
| Visa bara från dessa kontor  | A pick of offices by name; the list holds only their homes.                                                                                                                                                                            |

The agent list's settings: Rubrik, Ingress, and **Visa bara från dessa kontor**, a pick of
offices; the list holds the agents of those offices, in the CRM's order as today.

- **The picks** use WordPress's own token field (`FormTokenField`, the editor's standard
  multi-pick with suggestions and removable labels), fed by one small plugin endpoint that lists
  the site's agents, offices or areas by name and id, every record, listed or hidden, since the
  editor chooses. The block stores ids, so a renamed office keeps working.
- **The editor side moves into the plugin.** The theme's `assets/editor.js` builds every block's
  side panel from the `control` keys in `block.json` and previews the block as the server renders
  it (question 103, no bloat). That builder becomes the plugin's, with one new control for the
  picks, and the theme registers its blocks against it; one builder, no copy.
- **The theme's two list blocks become thin wrappers.** `kowboy/property-list` keeps its one
  design option (the background) and `kowboy/agents` its text card with the button; both take
  the plugin's list settings as their own (merged in PHP when the block is registered, so the
  settings are defined once) and call the plugin's one render function. The demo pages keep
  their block names and need no change; an editor who wants a plain list on another theme uses
  the plugin's block.
- **The shortcode** `[core_list]` takes every new parameter for free, as it is the same
  parameter set.

## The search box: the combo box with pills

- **One box** in the list's wrapper, where the theme's search card has the "Område" text field
  today: a text field with suggestions in three groups, **Områden**, **Kommuner** and **Län**
  (the last two only when the block's "Platssök" allows them). An area reads "Dalhem · Helsingborg".
- **It offers only places that would give a result:** the areas, kommuner and län that have at
  least one home matching the block's own setting (its statuses and its "show only from these").
  A list of homes for sale never offers a kommun whose only homes are sold. This is one query over
  the index (a group count over the filtered rows), run when the page renders and written into
  the block's markup as data, so the box is full the moment the page shows and no second request
  is made. On the sites this serves (hundreds to a few thousand homes) that query is a few
  milliseconds; it is not cached until a measurement says otherwise, the same stance as decision
  124 (the list's cost is WordPress's start, not the query).
- **Typing** narrows the suggestions in the browser, over at most a few hundred entries, so it
  is instant. **Choosing** one adds a pill under the field and runs the search at once. **Clicking
  a pill** removes it and runs the search again. Pills mean "any of these places".
- **Typing without choosing** and pressing Sök or Enter searches the words as free text, by the
  rule of `q` above. With pills present the words narrow further (Default 134): the pills say
  where, the words say which street or name. With no pill the words search alone, as the ask says.
- **The state is in the page address** (`?area=…&lkf=…&q=…`), as the filters are today, so a
  search can be shared, a page cache can hold it, and the back button works; the cards reload
  through the existing endpoint with the same parameters, as the tabs do.
- **Keyboard and screen readers** follow the standard combo box pattern (the WAI-ARIA combobox:
  arrow keys move, Enter chooses, Escape closes, the field names its list).
- **The plugin's own small script and stylesheet** draw the box, about two hundred lines, loaded
  only on a page that has a list with place search, and the theme restyles it with its own
  stylesheet. Not a library: Tom Select is the market-leading multi-pick combo box, but the box
  must run inside the shadow root the plugin opens around every view by default (a library that
  listens on the document for clicks outside breaks there), the option list is small, so a
  library's filtering and virtual scrolling buy nothing, and the look must be the theme's. That
  is the stated reason for not taking the library; the decision is recorded when it is built.
- **The Till salu page's search card** keeps its three choices (max price, minimum size,
  minimum rooms) and swaps the "Område" text field for this box.

## Performance, in numbers

| Moment                   | Work                                                                                                                     | Expected cost                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| A visitor searches       | One count and one page query over the index with keys on code, street and area name, and a join on the link table's keys | A few milliseconds on ten thousand homes; the page's cost stays WordPress's start (decision 124) |
| The page renders the box | One group count over the block's filtered rows                                                                           | A few milliseconds; written into the markup, no second request                                   |
| The sync writes a home   | Bounding boxes of every area, the full test on the few that pass, one table replace                                      | Under ten milliseconds                                                                           |
| The sync writes an area  | One pass over the homes' points, one table replace                                                                       | Well under a second for ten thousand homes                                                       |
| A plugin update          | The reindex that already runs, now with the link table                                                                   | Seconds, once                                                                                    |

Nothing in the visitor's path computes geometry, and nothing new is cached.

## Tests, all automatic

In `clients/wordpress/templates.test.ts` and the sync suite, against the real WordPress and
database the suites already drive:

1. The query answers `lkf` by prefix (two and four digits), `q` by the beginning of a street, an
   area name, a town, a kommun name and a län name, the place group as "any of", and the
   restrictions `agent`, `office` and `area_id` as lists, combined with status and price.
2. The outline test: a home inside an outline is linked, inside a hole is not, outside is not;
   a home the CRM put in one area and whose point lies in another is in both (133 a) or in the
   CRM's only (133 b); a redrawn outline re-links; a plugin update rebuilds the table.
3. The box offers only places with a matching home under the block's statuses and restrictions,
   in three groups with the kommun after an area's name.
4. The plugin alone (the theme off, the fixture set on) registers both blocks, renders them
   through the set's views, applies the restrictions and serves the pick endpoint and the editor
   script; the theme's wrappers keep the background and the text card, and the demo pages render.
5. The search box on the Till salu page: the markup carries the places as data, a pill in the
   address filters the list, and the free text with a pill narrows it (a browser test is not in
   the suite today; the markup and the endpoint are proved, the script is proved by the
   acceptance walk on staging).

Acceptance: AC 20's search half names these tests; the report is regenerated.

## Order of building, three sessions

1. **The query and the data** (plugin 0.5.0): the three columns and keys, the link table, the
   län table, the outline test, the new parameters, the reindex, tests 1 and 2. The theme's
   search form sends `q` instead of `area`. Nothing visible changes but the free text's rule.
2. **The blocks** (plugin 0.5.x, theme 1.1.0): the editor builder moves into the plugin with the
   pick control and the pick endpoint, the two blocks, the theme's wrappers, test 4.
3. **The search box** (plugin 0.5.x, theme 1.1.x): the places data, the script and stylesheet,
   the pills, the Till salu card, tests 3 and 5, then the deploy to the staging site.

## Not asked for, cheap to add

- A block restriction by kommun or län ("show only from Skåne"): the same `lkf` parameter, one
  more setting. Raised as an opportunity; built on Patric's word.
- The same place search on a Lovable site: the kit has no lists today; when a Lovable site needs
  them, the same stored fields and the same rules apply, in the Supabase function.

## The recommendation

- Build it in the plugin, as above: the query function takes `lkf`, `area`, `q` and the list
  restrictions; a home's areas are computed at the write by the outline test and stored in one
  link table; two blocks with the settings of the ask live in the plugin and render through the
  theme's views; the search box is the plugin's own small combo box with pills, fed from the
  page's own markup.
- Decide 133 (a home inside two outlines is in both areas, recommended) and confirm or refuse
  Default 134 (free text narrows the pills), then the three sessions above run in order.
