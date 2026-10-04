# The set "Kowboy 2026": the Figma design as a theme

Patric, 2026-09-28: the set built on the 2025 package is deleted (question 107), and the updated
design in Figma is the set **"Kowboy 2026"**, a theme. The field logic of the earlier views (what
each view shows, from `display` and `data`) is kept; the markup and the look are the design's. The design lives in the Figma file "Kowboy (Copy)"
(`JbB2ehlq1bsDspjTGBK5tw`, page "New Template"); the original file refuses the connected
account, question 108.

## What the design holds

Five pages, each at 1920 and 375 wide, plus a header and a footer on every page:

| Page            | Frame (1920)                            | Sections, top to bottom                                                                                                                                                                                                                                                               |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home            | `Home ACF - Neutral` (2671:4236)        | page hero (full-bleed image, title, lead, two buttons) · intro card with a label, a title, a text and four figures · agents (two cards and a text card with a button) · property list with status tabs · lead form · footer                                                           |
| Till salu       | `Till salu` (2635:787)                  | page hero with the search form on its lower edge · status tabs · property cards, three a row, "Visa fler" · lead form                                                                                                                                                                 |
| Sålda bostäder  | `Sålda bostäder` (2635:1088)            | page hero · sold cards, three a row, "Visa fler" · lead form                                                                                                                                                                                                                          |
| Om oss          | `Om oss` (2675:4557)                    | page hero · intro text with three numbered feature cards and a closing text · agents · testimonials slider · lead form                                                                                                                                                                |
| Single property | `Single Property — Redesign` (2710:574) | hero (image, one or many, or a video; label, street, price, rooms, area) · description with fact chips, floor plan, viewings box, agent card · interest form · image grid, "Visa fler bilder" · fact tables (collapsible) · area section: images, collapsible texts · map · lead form |

Mobile frames: `Home ACF – Neutral` (2635:1695), `Till salu – Neutral v2` (2635:2001),
`Sålda bostäder – Neutral v2` (2635:2314), `Om oss – Neutral v2` (2635:2573), `Single Property`
(2710:1065).

Tokens (the file's variables on the list page): Manrope throughout (Display/Large 48 semibold,
Body/Large 16, Body/Small 12, Label 12 medium, Name 16 semibold); colours Ink `#111111`,
Secondary `#444444`, Border `#D1D1D6`, Subtle `#F6F6F2`, White, an overlay black at 32 %.

## The shape: one theme

The set is a WordPress theme, `clients/wordpress/themes/kowboy-2026/`, one package that
holds everything the design needs and that a site installs as its theme (decision 2026-09-28):

- **The sections as blocks**, one block per section shape, reused wherever the shape repeats
  (Patric: a similar section is the same block, never a new one): `page-hero` (every page's
  top: image, title, lead, optional buttons, optional search form), `intro` (label, title,
  text, figures), `feature-list` (text, numbered cards, closing text), `agents` (cards from
  Core's agent records, an optional text card), `property-list` (the plugin's list function
  with status tabs and filters), `testimonials` (slider), `lead-form`. Every field has a
  Swedish label and help text; background images are fields. Pages are made of these blocks in
  the editor; the demo pages (Home, Till salu, Sålda bostäder, Om oss) are created on install.
- **Theme options** (Swedish UI): the logotype in a bright and a dark variant, the main
  typography (the display, body and label styles), the office's address, phone and e-mail for
  the footer, the privacy policy page, the lead form's receiving address.
- **The CRM views** under `core/` in the theme, where the plugin's override rule finds them
  first: the property list wrapper and card, the single property (hero, facts, floor plan,
  viewings, agent, interest form, image grid, fact tables, area, map), the agent card and page,
  and the 2026 views restyled for the kinds the design does not draw (office, area, project,
  association). Rendered in shadow roots, the plugin's default from now on (Patric).
- **One image component** (`core/parts/image.php`) for every CRM image: `srcset` at the CDN's
  widths, `sizes` per slot, `loading="lazy"` and `decoding="async"`, the first hero image
  eager. The two image grids of the single page are the same component.
- **One hero component** for the single page: a Vimeo video when the record has one (question
  104), else one image, else the images in a Swiper slider with a slight Ken Burns motion
  (the vendored Swiper and Ken Burns of 2026 stay).
- **Header and footer** from the design, the navigation from WordPress menus.

The sections are WordPress's own blocks (question 103, Patric: no bloat): a `block.json` per
section names its fields with Swedish labels and help texts, a `render.php` draws it on the
server, and one editor script (`assets/editor.js`) builds every block's settings panel from those
fields and previews the section as the server renders it. The theme options are the Customizer's
(Utseende, Anpassa, "Kowboy 2026"). The plugin (`core-client`) stays the CRM engine; the theme
only renders.

## Built on 2026-09-28

Everything above stands in `clients/wordpress/themes/kowboy-2026/` and runs on the staging site
(`docs/staging-site.md`): the seven blocks, the demo pages and menus made on activation (Hem as
the front page, Till salu, Sålda bostäder, Om oss), the theme options, header and footer, the
hero part (a Vimeo link among a listing's links, an uploaded film, one image, or a Swiper slider
with a slight zoom), the image function (`kowboy_image`: lazy, asynchronous, `sizes`, and a
`srcset` over the CDN's widths 480 to 1920, question 109), the property card with its Swiper,
the list wrapper with tabs, search form and "Visa fler", the property page with chips, floor
plan, viewings, agent, interest form, gallery, fact tables, area texts and the OpenStreetMap map
(Leaflet, vendored), the agent, office and area pages, and the forms as dummies (question 105). The plugin's set registry now takes a theme (`core_client_register_template_set` from
`functions.php`; the active theme's set wins when none is chosen), shadow DOM is on by default,
and the deploy script installs the theme too. The tests
(`clients/wordpress/templates.test.ts`) cover the lists, the pages, the blocks and demo pages,
the theme options, and the set machinery with a fixture set plugin.

On the same night the sections were set to the file's exact values through Figma's API (question
102), and a second agent with no memory of the build compared the rendered pages with the
design and listed 22 mismatches; the notable ones are fixed (the search card on the hero's edge,
the tabs centred under it, the card and agent gradients as drawn, the section bands, the viewing
card with its button inside, the side agent card's shape, the hero heights, the footer's three
columns, the scroll indicator, the map's pin and controls). What remains is content the office
adds (the hero pictures, the logotype, the address).

The phone layout was checked later the same night against the file's four phone frames (Till
salu, the home page, Om oss and the property page), fetched as pictures through Figma's image
endpoint because its node endpoint answers "rate limit exceeded" until early October. Fixed:
the hero titles at the phone sizes the frames draw (40, 34 and 30 px), the tall hero a screen
high with its buttons stacked and the scroll indicator on the hero's lower edge, the search card
under the hero's text straddling its edge, the figures and the quote in the frames' sizes, the
footer centred, and the site's name on one line in the header. One thing the frames disagree
on: the phone frames draw the "Ska du sälja din bostad?" form with the fields "Ditt namn", "Din
gatuadress", "E-post" and "Mobil", the desktop frames with "Förnamn", "Efternamn", "Mobil" and
"E-post". The theme follows the desktop frames on every width; the field list is part of
question 105 (where a submission goes) and is not settled here.

## Patric's punch list, 2026-10-03

Patric's list after walking the set on the dev site, done in one round (pull request into
staging; the fact-table rows themselves are pull request 71's):

- **The lists.** The card and agent pictures were blurry on desktop: the slot's `sizes` asked
  for the card's width, and a photo wider than tall is scaled up to cover a 3:4 card. The slots
  now ask for about twice the card's width. The card's dark fade was under the slider (Swiper
  puts its root at z-index 1); it is above it now. The card's link covered the slider, so the
  photos could not be swiped: the link covers the text only on a card with a slider, and a plain
  click on a photo follows the link through Swiper's click event (a swipe does not).
- **Forms.** The fields show their names as placeholders; the floating labels are gone.
- **Header.** Over a hero the header carries a shade from the top edge, so the bright logotype
  and menu read over a bright photo. The hamburger's bars fold into a cross and the menu slides
  in, the items one after the other; CSS transitions, no library.
- **Heroes.** The tall hero and a property's hero fill the screen on every width (`100svh`).
  The property hero's spacing under the title matched the spacing above it (40 px; the content's
  own 40 px padding was the excess).
- **The property page.** The selling heading (`heading`) stands where "Om bostaden" stood when
  the listing has one. The first agent is "Ansvarig mäklare", the rest "Kontakta även". A click
  on the hero photo or a gallery photo opens a full-screen slider (Swiper, already vendored:
  arrows, keys, pinch zoom, the files at the CDN's full width). The fact tables and the area
  texts are one accordion part (`parts/accordion.php`) whose panels open with an animation
  (CSS `grid-template-rows`, no library), the rows in the design's two equal columns.
- **The lists on an agent's and an area's page** carry the status tabs like the home page's.
- **Spacing.** Every section keeps its 72 px above and below; the rule that cut the top padding
  of a following section made the home page uneven.
- **The footer form.** "Ska du sälja din bostad?" is the footer's, on every page, its words
  theme options (Formulär); the lead-form block and the property page's own copy are gone.
- **Page titles and sharing.** `<what the page is about> - <site name>`, as the master site:
  a listing's street, an agent's or area's name, a page's title. `inc/seo.php` writes the
  description and the Open Graph and Twitter tags from the record (its text and first photo at
  width 1200) or the page (its excerpt and the hero's first picture). A site running an SEO
  plugin would print a second set; none is on the dev site.
- **Against the design again.** The single-property frame was fetched and compared: the
  accordion list, the two-column rows and the agent block match it now; the Home frame too.
  Figma's plan allowed two frames before its call limit; the remaining frames wait for the
  limit to reset or a paid plan.

The plugin got `?debugpl` on every record's page (its own pull request): the record's JSON in a
foldable viewer, for signed-in editors.

## Patric's second list, 2026-10-03

Patric's list after the first round reached the staging site, done straight on `staging`:

- **One hero.** `kowboy_hero()` (`inc/media.php`) is the one call for a page's, a property's
  and an area's hero: the media the page has, else the listings' photos from
  `kowboy_listing_photos()` (the first photo of each of the five newest listings for sale, then
  their second ones, as a slider), narrowed to an area's listings on an area's page. The hero
  block got the media choice "Bostädernas bilder" for that explicitly. The tall hero and a
  property's hero reach the fold: `100svh` less WordPress's admin bar (`--wp-admin--admin-bar--height`),
  which pushed the fold down for a signed-in viewer. A property's overlay darkens the lower
  half only; the header's own shade takes the top. The property hero's padding under the
  title is the design's 28 px.
- **Cards.** The area's name stands where the tenure stood; the fee is gone from the price row.
- **Agents and testimonials.** The agents block lists every agent (no count). The testimonials
  block shows the agents' reviews from Core, its own quotes only when Core has none.
- **Areas.** The archive `/omrade/` lists the areas as cards (`core/card-area.php`,
  `core/list-area.php`): the area's first picture, else `assets/placeholder.svg`, the name and
  how many homes are for sale there. The footer's menu ends with a link to it. An area's page
  opens with the hero, then the texts, the map and the list, with a section's spacing between;
  an area without homes shows no list at all.
- **Viewings.** The page carries every viewing, past ones hidden, and the script
  (`setupViewings`) hides each one once it is over and shows the CRM's `empty_text` when none
  remains, so a cached page never freezes a viewing. A viewing's "Boka här" follows its own
  `self_registration`; the CRM's `visible_limit` caps how many show. A viewing from midnight to
  midnight is a whole day and shows no time (question 123: the CRM sends no flag).
- **Bids.** "Budgivning" at the side: `display.highest_bid` (R-008) and the bids as the CRM
  allows them, latest first, a cancelled one struck through.
- **Photos (Patric's fourth list).** One gallery part (`parts/gallery.php`) for a property and
  an area: on a phone a Swiper slider of every photo, fitted whole, at the screen's visible
  height as it is right now (`100dvh`: a pixel height measured at load matched the address bar
  in or out, not both, which showed as filling only when snapped from one side), the page
  snapping to it (`scroll-snap-type: y proximity`), in the grid's place (Patric kept the slider
  after the trial); wider, the grid. The hero's and the slider's files are sized for a portrait screen (`sizes` 250vw: a
  landscape photo covering a portrait screen is about two and a half widths), so the 1920 file
  serves a phone; every CRM image carries the CDN's widths as `srcset`, which is how the pixel
  density counts. The fact tables start closed.
- **The map on a phone.** Leaflet's `detectRetina`: on a high-density screen the tiles of one
  zoom level in are drawn at half size, so OpenStreetMap is sharp.
- **`?debugpl`.** The viewer's script moved from the head to the end of the page: defined
  before the elements were parsed, it read each one empty and showed nothing.
- **The property hero swipes** (Patric, 2026-10-03). It carries every photo (the plans left out)
  with the same slow fade and Ken Burns zoom as every hero, and also moves on a swipe or a drag;
  a tap opens the full-screen slider at the photo shown. The hero part takes `swipe`, and the slides carry their index. The plans
  come last in every gallery (the phone slider, the grid and the full-screen slider), after the
  photos, so a hero index is a gallery index.
- **Several floor plans slide** with dots (Patric, 2026-10-03), the slider as tall as the tallest
  plan (a height measured at start, Swiper's `autoHeight`, was a few pixels: the files load
  lazily); one plan stands as before. The files carry the CDN's widths in `srcset` like every image.
- **`?debugpl` for everyone** (Patric, 2026-10-03): the sign-in check is gone.
- **"Dokument och länkar"** (Patric, 2026-10-03): the documents and the links of the home and of
  its association as one list, an icon per kind, no dividers, deduplicated by address and then by
  name. The association carries `documents` in the contract and no `links`; the view reads
  `links` on it all the same, so a contract that adds them needs no change here.
- **An association's page** (`core/single-core_association.php`, Patric 2026-10-03): the name
  and contact, the rows a home's page shows in its "Föreningen" table (`inc/association.php`
  carries them for both), the documents as the home's list, and the association's homes. An
  area's page has listed its homes since the first round. The associations archive (/forening/)
  is the areas archive's twin: cards with the placeholder, the name and the count for sale. Both
  archives page by numbers (`parts/paging.php`, 24 cards a page, WordPress's own `/page/N/`), not
  by "Visa fler" (Patric, 2026-10-03).
- **Two layout breaks of the same hour, fixed.** The plan slider's row of slides widened the
  property column without end on a phone (a grid column's minimum is its content unless
  `min-width: 0`), so both property columns now shrink below their content. The agents grid with
  the text card was three columns (two fixed, one wide) for two agents; with every agent listed,
  each third agent fell in the wide column. The card now spans two columns after the agents in
  the four-column grid. The card dots are lighter (opacity 0.55).
- **Addresses as norbanmakleri.se writes them** (plugin, Patric 2026-10-03 and 2026-10-04): every
  record's slug is built from its stored values and ends in its id (question 101), and an area's
  carries its kommun first, named from the LKF code by the plugin's table of SCB's 290
  municipalities (`includes/municipalities.php`). The area page shows the kommun over its title
  as the property page shows its location.

## Order of work

1. The plan and the questions (this page), the plugin's shadow DOM default, the 2026 set shelved.
2. The theme's skeleton: tokens as CSS variables, Manrope, header, footer, the page templates.
3. The CRM views from the design, on the staging site through the loop
   (`docs/staging-site.md`, "The loop as it runs"): list, cards, single property, agents.
4. The section blocks and the theme options (with 103), the demo pages.
5. The forms (105), the map (106), the video hero (104).
6. Tests: the template suite moved to the theme, the acceptance report.
7. The look, section by section against the file's values (102), on the staging site.
8. Later, when Patric asks: the theme with its demo data as an installable package.
