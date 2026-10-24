---
name: kowboy-site-promotion-realestate
description: Makes the client-facing report (three A4 pages, as a PDF and a web page) that sets a real estate broker's current website beside their next one built on Kowboy Core, including a page on how search brings customers. Use when asked for a site comparison, promotion or sales report for a broker moving to Core.
---

# Site promotion report for a real estate broker

Makes, for any broker, the report Patric approved for Norban on 2026-10-20, plus a third page on
search:

1. **The story in numbers:** the lead, a home's page on a phone, tiles, the phone speed chart and
   what the broker keeps.
2. **The steps forward:** the list and an area on a map, then each step with what it means for
   the broker and for visitors.
3. **Search that brings customers:** the buyers' figures, the path from a search to a lead in the
   CRM, and what Core does so Google finds every home.

Every claim prints only when a measurement or a check on the live site carries it. A claim the run
cannot back is left out, never softened.

## Rules

- **Read only.** Both sites are only read, with GET and HEAD requests, page views and Lighthouse
  runs. Never press a button and never send a form: behind a preview sits a real brokerage's CRM.
  The script's browser aborts every other request; don't add steps that click.
- **Tone.** Kowboy provides both sites. Today's site is "today's site", never criticised: the
  client leaves something good for something better. Where today's site measures better
  (`theirsBetter` in check.json), tell the person you work for in chat, never in the report.
- **No invented facts.** Change wording only in `model.mjs` or `template.html`, and keep each
  claim behind the check that carries it. The figures from the National Association of Realtors
  (NAR) and the sources in the footers are fixed text; check that they are still current before
  sending.
- **Language.** The report is in English. Its text never names a register number, a person or an
  internal document.

## Run

1. Run the script. It takes about 6 minutes: Lighthouse runs 3 times on each of 4 pages, one run
   at a time.

   ```sh
   node .claude/skills/kowboy-site-promotion-realestate/report.mjs \
     --ours https://<core site> --theirs https://<current site> \
     --brand Norban --brandFull "Norban Mäkleri" --out <scratchpad>/<client>-report
   ```

   Optional flags:
   - `--crm` (default Vitec);
   - `--runs` (default 3);
   - `--list` (default `/till-salu/`);
   - `--date`;
   - `--property /objekt/<path>/`.

   By default the report shows the first home that is for sale on both sites, preferring one with
   a bookable viewing. `--brandFull` defaults to the current site's `og:site_name`, and `--brand`
   to `--brandFull`.

   It needs:
   - Chromium at `/opt/pw-browsers/chromium` (or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`);
   - the repo's `node_modules` (Playwright);
   - `npx` able to fetch `lighthouse@12.8.2`.

2. **Check the layout.** `fits` must be true:
   - every sheet's content fits its A4 page;
   - the PDF has one page per sheet;
   - the phone view never scrolls sideways.

   Look at `sheet-1.png` to `sheet-3.png`. If a sheet overflows, shorten that page's text. Then
   re-render in seconds with `--from <out>/facts.json --out <out>`.

3. **Read check.json:**
   - `claimsLeftOut`: what the run could not back;
   - `theirsBetter`: private, never in the report;
   - `facts.addresses.failed`: addresses of today's site that do not work on the Core site.
4. **Deliver:**
   - save `report.pdf` as `/mnt/project-files/<client>-comparison/<client>-next-website.pdf`;
   - publish `report.html` as a new artifact for the client;
   - reply with both, and put `theirsBetter` and anything left out in Notes.

`node .claude/skills/kowboy-site-promotion-realestate/selftest.mjs` renders a saved Norban run and
checks the approved sentences. Run it after changing the wording or the layout.

## On a preview site

- **No site name.** A preview without its site name shows the server's name in the logo. The
  pictures hide it; ask for the site name to be set before the client sees the preview itself.
- **Search engines blocked.** A preview blocks search engines on purpose (`noindex`). The search
  score leaves that one check out, and the report says so.
- **Test key.** A preview's forms may use Cloudflare's test key for the robot check
  (`facts.features.testKey`). The robot check claim is about the product.

## Files

- `report.mjs`: reads both sites, measures, takes pictures and prints.
- `lib.mjs`: the pure helpers.
- `model.mjs`: the words, each one gated by a check.
- `template.html`: the three sheets.
- `selftest.mjs` and `fixture/`: the saved Norban run.
