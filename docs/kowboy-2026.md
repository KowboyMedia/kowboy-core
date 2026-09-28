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
`srcset` as soon as the CDN serves more widths, question 109), the property card with its Swiper,
the list wrapper with tabs, search form and "Visa fler", the property page with chips, floor
plan, viewings, agent, interest form, gallery, fact tables, area texts and the OpenStreetMap map
(Leaflet, vendored), the agent, office and area pages, and the form entries (Förfrågningar, question
105). The plugin's set registry now takes a theme (`core_client_register_template_set` from
`functions.php`; the active theme's set wins when none is chosen), shadow DOM is on by default,
and the deploy script installs the theme too. The tests
(`clients/wordpress/templates.test.ts`) cover the lists, the pages, the blocks and demo pages,
the form entries, the theme options, and the set machinery with a fixture set plugin.

What is not from the design's file yet, because Figma's connector stopped after two section reads
(question 102): the exact spacings, radii and type sizes of every section are read from the
design's screenshots and the frames' geometry, not from the file's values; the next pass with a
token reads them section by section.

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
