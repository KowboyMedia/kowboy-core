// The theme "Kowboy 2026" (the default set) and the plugin's template machinery against the real
// WordPress (test/site.ts) with records from the fake polling CRM through the real Core: the lists
// with their filters and reloads, the single pages, the section blocks and the demo pages, the
// form entries, the override rule with a set plugin, the selector and shadow DOM.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { harness, TOKEN, type Harness } from '../../acceptance/harness.js';
import { fakePollingAdapter, poll } from '../../adapters/fake-polling/index.js';
import * as crm from '../../adapters/fake-polling/crm.js';
import { BELL_SECRET, CONNECTION, type ClientDriver } from '../sync-scenarios.js';
import { fillTheCrm, listing, NORRMALM, P1 } from './test/records.js';
import { driver, siteUrl, start, stop, wp, WP_ROOT } from './test/site.js';

const THEME_OVERRIDES = join(WP_ROOT, 'wp-content', 'themes', 'twentytwentyone', 'core');

let core: Harness;
let site: ClientDriver;

/** A page's HTML, its non-breaking spaces (the display strings' thousands) read as spaces. */
const page = async (path: string): Promise<{ status: number; body: string }> => {
  const response = await fetch(`${siteUrl}${path}`);
  return { status: response.status, body: (await response.text()).replace(/\u00a0/g, ' ') };
};

/** The path and query of an address on the site, as `page` takes it. */
const pathOf = (url: string): string => new URL(url).pathname + new URL(url).search;

const reload = async (
  params: Record<string, string>,
): Promise<{ html: string; total: number; has_more: boolean }> => {
  const query = new URLSearchParams({ rest_route: '/core/v1/list', ...params });
  const response = await fetch(`${siteUrl}/?${query.toString()}`);
  expect(response.status).toBe(200);
  const result = (await response.json()) as { html: string; total: number; has_more: boolean };
  return { ...result, html: result.html.replace(/\u00a0/g, ' ') };
};

const permalink = async (datatype: string, remoteId: string): Promise<string> => {
  const items = await driver<{ remote_id: string; permalink: string }[]>('items', datatype);
  const item = items.find((one) => one.remote_id === remoteId);
  expect(item, `${datatype} ${remoteId} on the site`).toBeDefined();
  return new URL(item!.permalink).pathname + new URL(item!.permalink).search;
};

beforeAll(async () => {
  crm.reset();
  core = await harness({
    adapters: [fakePollingAdapter],
    connections: [{ id: CONNECTION, provider: 'fake-polling' }],
    subscriber: false,
  });
  site = await start({ url: core.baseUrl, token: TOKEN, bellSecret: BELL_SECRET });
  // Which of this CRM's status ids the site lists as for sale, coming and sold: the site's setting.
  await driver('option', 'core_client_status_for_sale "active"');
  await driver('option', 'core_client_status_coming "pre"');
  await driver('option', 'core_client_status_sold "done"');
  // The site's own shadow DOM and set choices: none, so the defaults are what is tested.
  await driver('option', 'core_client_shadow_dom null');
  await driver('option', 'core_client_template_set null');

  fillTheCrm();
  await poll();
  await site.trigger('delta');
}, 120_000);

afterAll(async () => {
  rmSync(THEME_OVERRIDES, { recursive: true, force: true });
  await stop();
  await core.stop();
});

describe('the set Kowboy 2026 on the WordPress client', () => {
  it('renders the property archive as the for-sale list, first page on the server, with the filter form', async () => {
    const { status, body } = await page('/?post_type=core_property');
    expect(status).toBe(200);
    expect(body).toContain('class="k-list"');
    expect(body).toContain('name="max_price"');
    // For sale and coming, newest first; sold ones and a project's homes stay out.
    const streets = [
      ...body.matchAll(/<span class="k-card__street">(Kungsgatan \d+)<\/span>/g),
    ].map((match) => match[1]);
    expect(streets).toEqual(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);
    expect(body).toContain('7 250 000 kr');
    // The area's name, not the tenure, and no fee on a card (Patric, 2026-10-03).
    expect(body).not.toContain('Avgift');
    expect(body).toContain('<span class="k-card__area">Södermalm</span>');
    expect(body).toContain('82 kvm');
    expect(body).toContain('<span class="k-card__status">Visning ');
    // The theme's assets, and no font from a third party: Manrope is self-hosted.
    expect(body).toContain('kowboy-2026.css');
    expect(body).toContain('kowboy-2026-vendor.css');
    expect(body).toContain('kowboy-2026.js');
    expect(body).toContain('kowboy-2026-vendor.js');
    expect(body).not.toContain('fonts.googleapis.com');
    // Every CRM image is lazy and asynchronous, with the CDN's widths as a srcset.
    expect(body).toContain('loading="lazy" decoding="async"');
    expect(body).toContain(
      'srcset="https://img.test/P-3-1_480.jpg 480w, https://img.test/P-3-1_640.jpg 640w',
    );
  });

  it('answers the reload endpoint with the cards of one page, the total and whether more follow', async () => {
    const first = await reload({
      entity: 'property',
      status: 'active,pre',
      per_page: '2',
      page: '1',
    });
    expect(first.total).toBe(3);
    expect(first.has_more).toBe(true);
    expect(first.html.match(/<article class="k-card[ "]/g)).toHaveLength(2);
    const second = await reload({
      entity: 'property',
      status: 'active,pre',
      per_page: '2',
      page: '2',
    });
    expect(second.has_more).toBe(false);
    expect(second.html).toContain('Kungsgatan 1');
  });

  it('filters by status, price, size, rooms, free text, agent and office, and sorts sold ones by date', async () => {
    const sold = await reload({ entity: 'property', status: 'sold', sort: 'sold' });
    expect(
      [...sold.html.matchAll(/<span class="k-card__street">(Kungsgatan \d+)<\/span>/g)].map(
        (match) => match[1],
      ),
    ).toEqual(['Kungsgatan 5', 'Kungsgatan 4']);
    expect(sold.html).toContain('4 200 000 kr');
    expect(
      (await reload({ entity: 'property', status: 'active,pre', max_price: '4000000' })).total,
    ).toBe(1);
    expect(
      (await reload({ entity: 'property', status: 'active,pre', min_living_space: '100' })).total,
    ).toBe(1);
    expect((await reload({ entity: 'property', status: 'active,pre', min_rooms: '3' })).total).toBe(
      2,
    );
    expect((await reload({ entity: 'property', status: 'active,pre', area: 'söder' })).total).toBe(
      1,
    );
    expect(
      (await reload({ entity: 'property', status: 'active,pre', area: 'kungsgatan 2' })).total,
    ).toBe(1);
    expect((await reload({ entity: 'property', status: 'active,pre', agent: 'S-2' })).total).toBe(
      2, // P-2 is Bertil's, and he is the second agent on P-3
    );
    expect((await reload({ entity: 'property', office: 'B-1' })).total).toBe(5);
    expect((await reload({ entity: 'property', project: 'PR-1' })).total).toBe(1);
    expect((await reload({ entity: 'agent', office: 'B-1' })).total).toBe(2);
    const byPrice = (await reload({ entity: 'property', status: 'active', sort: 'price_asc' }))
      .html;
    expect(byPrice.indexOf('Kungsgatan 2')).toBeLessThan(byPrice.indexOf('Kungsgatan 1'));
  });

  it('finds homes by a län or kommun code, by chosen areas, and by the beginning of a street, area, town, kommun or län name', async () => {
    const total = async (params: Record<string, string>): Promise<number> =>
      (await reload({ entity: 'property', status: 'active,pre', ...params })).total;
    // A code matches by its beginning: the län, the kommun; a code of three digits is no code.
    expect(await total({ lkf: '01' })).toBe(3);
    expect(await total({ lkf: '0180' })).toBe(2);
    expect(await total({ lkf: '0163' })).toBe(1);
    expect(await total({ lkf: '12' })).toBe(0);
    expect(await total({ lkf: '018' })).toBe(3);
    // The free text matches the beginning of a street, an area, a town, and a kommun or län name through the plugin's tables.
    expect(await total({ q: 'Kungsgatan 2' })).toBe(1);
    expect(await total({ q: 'söder' })).toBe(1);
    expect(await total({ q: 'stockh' })).toBe(3);
    expect(await total({ q: 'Sollen' })).toBe(1); // Sollentuna kommun, 0163: P-3's code
    expect(await total({ q: 'Stockholms l' })).toBe(3); // Stockholms län, 01
    expect(await total({ q: 'gatan' })).toBe(0); // the beginning only
    expect(await total({ area: 'kungsgatan 2' })).toBe(1); // the parameter's old name, one release more
    // The chosen areas and codes are one group, any of them; the free text narrows the group.
    expect(await total({ areas: 'D-2' })).toBe(1); // P-2 by Norrmalm's outline, not by the CRM
    expect(await total({ areas: 'D-2', lkf: '0163' })).toBe(2);
    expect(await total({ areas: 'D-2', q: 'Kungsgatan 1' })).toBe(0);
    expect(await total({ area_id: 'D-1,D-2', areas: 'D-2' })).toBe(1);
    // "Show only from these": any of the agents (a home's second agent counts), offices or areas.
    expect(await total({ agent: 'S-1,S-2' })).toBe(3);
    expect(await total({ agent: 'S-2' })).toBe(2);
    expect(await total({ office: 'B-1,B-9' })).toBe(3);
    expect(await total({ area_id: 'D-2' })).toBe(1);
    expect((await reload({ entity: 'agent', office: 'B-1,B-9' })).total).toBe(2);
  });

  it('offers only the places with a matching home, in three groups with the kommun after an area’s name, and draws the box with its pills from the address', async () => {
    type Place = { id: string; label: string; homes: number };
    type Places = { areas: Place[]; municipalities: Place[]; counties: Place[] };
    const places = (params: Record<string, unknown>): Promise<Places> =>
      driver<Places>('places', JSON.stringify(params));
    // The Till salu list: for sale and coming, every group; a project's home counts in no list.
    expect(
      await places({ entity: 'property', status: 'for_sale,coming', place_search: 'places' }),
    ).toEqual({
      areas: [
        { id: 'D-2', label: 'Norrmalm · Stockholm', homes: 1 },
        { id: 'D-1', label: 'Vasastan · Stockholm', homes: 3 },
      ],
      municipalities: [
        { id: '0163', label: 'Sollentuna', homes: 1 },
        { id: '0180', label: 'Stockholm', homes: 2 },
      ],
      counties: [{ id: '01', label: 'Stockholms län', homes: 3 }],
    });
    // The list's own setting decides what is offered: sold homes, a picked agent, areas only;
    // the visitor's own choices on the address never narrow the offer.
    expect(await places({ entity: 'property', status: 'sold', place_search: 'places' })).toEqual({
      areas: [{ id: 'D-1', label: 'Vasastan · Stockholm', homes: 2 }],
      municipalities: [{ id: '0180', label: 'Stockholm', homes: 2 }],
      counties: [{ id: '01', label: 'Stockholms län', homes: 2 }],
    });
    expect(
      await places({
        entity: 'property',
        status: 'for_sale,coming',
        agent: 'S-2',
        place_search: 'areas',
        areas: 'D-2',
        q: 'Kungsgatan 1',
      }),
    ).toEqual({
      areas: [
        { id: 'D-2', label: 'Norrmalm · Stockholm', homes: 1 },
        { id: 'D-1', label: 'Vasastan · Stockholm', homes: 2 },
      ],
      municipalities: [],
      counties: [],
    });
    expect(
      await places({ entity: 'property', status: 'for_sale,coming', place_search: 'none' }),
    ).toEqual({ areas: [], municipalities: [], counties: [] });

    // A home naming an area the site has no record of (Patric, 2026-10-04: the staging site's
    // homes do): the area is offered and its pill is named as the home names it, with the kommun
    // of the home's code; the search by it finds the home through the CRM's assignment. The
    // same when the area's record arrives and goes again: the record names it meanwhile, and
    // the CRM's assignment outlives the record.
    const areas = async (): Promise<Place[]> =>
      (await places({ entity: 'property', status: 'for_sale,coming', place_search: 'areas' }))
        .areas;
    const hjorthagen = { id: 'D-9', label: 'Hjorthagen · Stockholm', homes: 1 };
    const offeredPill = '<option value="areas:D-9" selected>Hjorthagen · Stockholm</option>';
    try {
      crm.put(
        'property',
        'P-7',
        listing('P-7', { districts: ['D-9'], district_name: 'Hjorthagen', lkf: '0180' }),
      );
      await poll();
      await site.trigger('delta');
      expect(await areas()).toEqual([
        hjorthagen,
        { id: 'D-2', label: 'Norrmalm · Stockholm', homes: 1 },
        { id: 'D-1', label: 'Vasastan · Stockholm', homes: 3 },
      ]);
      const unknown = await page('/?post_type=core_property&areas=D-9');
      expect(unknown.body).toContain(offeredPill);
      expect(unknown.body).toContain('Kungsgatan 7');
      expect(unknown.body).not.toContain('Kungsgatan 1');
      crm.put('area', 'D-9', {
        district_id: 'D-9',
        district_name: 'Hjorthagen (CRM)',
        branch_id: 'B-1',
        lkf: '0180',
      });
      await poll();
      await site.trigger('delta');
      expect((await areas())[0]).toEqual({ ...hjorthagen, label: 'Hjorthagen (CRM) · Stockholm' });
      crm.remove('area', 'D-9');
      await poll();
      await site.trigger('delta');
      expect((await areas())[0]).toEqual(hjorthagen);
      expect((await page('/?post_type=core_property&areas=D-9')).body).toContain(offeredPill);
    } finally {
      crm.remove('area', 'D-9');
      crm.remove('property', 'P-7');
      await poll();
      await site.trigger('delta');
    }
    expect(await areas()).toHaveLength(2);

    // The archive page: the box in the list's filters as a multi-select of the places in three
    // groups, the chosen ones selected (the pills), the words and the chosen places in the hidden
    // fields a plain submit sends, the library (lib/tom-select), the script and the stylesheets,
    // the stylesheets inside the shadow root too; the chosen places are "any of", the words
    // narrow them (Default 134).
    const { body } = await page('/?post_type=core_property&areas=D-2&lkf=0163&q=Kungs');
    expect(body).toContain('data-place-search');
    expect(body).toContain(
      '<select class="core-place-search__select" id="core-place-1" multiple autocomplete="off" data-placeholder="Område, kommun eller län"',
    );
    expect(body).toContain(
      '<optgroup label="Områden"><option value="areas:D-2" selected>Norrmalm · Stockholm</option><option value="areas:D-1">Vasastan · Stockholm</option></optgroup>',
    );
    expect(body).toContain(
      '<optgroup label="Kommuner"><option value="lkf:0163" selected>Sollentuna</option><option value="lkf:0180">Stockholm</option></optgroup>',
    );
    expect(body).toContain(
      '<optgroup label="Län"><option value="lkf:01">Stockholms län</option></optgroup>',
    );
    expect(body).toContain('<input type="hidden" name="q" value="Kungs">');
    expect(body).toContain('<input type="hidden" name="areas" value="D-2">');
    expect(body).toContain('<input type="hidden" name="lkf" value="0163">');
    expect(body).toContain('lib/tom-select/tom-select.complete.min.js');
    expect(body).toContain('place-search.js');
    expect(body).toMatch(
      /<template shadowrootmode="open"><link rel="stylesheet" href="[^"]*lib\/tom-select\/tom-select\.min\.css[^"]*"><link rel="stylesheet" href="[^"]*assets\/place-search\.css[^"]*">/,
    );
    expect(body).toContain('Kungsgatan 2');
    expect(body).toContain('Kungsgatan 3');
    expect(body).not.toContain('Kungsgatan 1');
    // A page without a box loads none of the files.
    const agent = (await page(await permalink('agent', 'S-1'))).body;
    expect(agent).not.toContain('place-search.js');
    expect(agent).not.toContain('tom-select');
    // A chosen place the list does not offer (no home here) still stands as a pill in its group,
    // named as the site can (an unknown area by its id, a kommun by the plugin's table, a whole
    // code by its kommun and the code), marked so the script drops it with its pill.
    const unoffered = await page('/?post_type=core_property&areas=D-9&lkf=1280,018001');
    expect(unoffered.body).toContain(
      '<option value="areas:D-1">Vasastan · Stockholm</option><option value="areas:D-9" selected data-homes="0">D-9</option></optgroup>',
    );
    expect(unoffered.body).toContain(
      '<option value="lkf:0180">Stockholm</option><option value="lkf:1280" selected data-homes="0">Malmö</option><option value="lkf:018001" selected data-homes="0">Stockholm (018001)</option></optgroup>',
    );
  });

  it('links a home to the CRM’s area and to every area whose outline holds its point (133 a), relinks on a changed outline or point, and rebuilds the links on a plugin update', async () => {
    // The outline test on hand-drawn shapes: a square, a square with a hole, two separate squares, no outline.
    const inside = async (lat: number, lng: number, polygon: unknown): Promise<boolean> =>
      (await driver<{ inside: boolean }>('inside', JSON.stringify({ lat, lng, polygon }))).inside;
    const ring = (x: number, y: number, size: number): number[][] => [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ];
    expect(await inside(5, 5, [[ring(0, 0, 10)]])).toBe(true);
    expect(await inside(5, 15, [[ring(0, 0, 10)]])).toBe(false);
    expect(await inside(5, 5, [[ring(0, 0, 10), ring(4, 4, 2)]])).toBe(false);
    expect(await inside(2, 2, [[ring(0, 0, 10), ring(4, 4, 2)]])).toBe(true);
    expect(await inside(25, 25, [[ring(0, 0, 10)], [ring(20, 20, 10)]])).toBe(true);
    expect(await inside(15, 15, [[ring(0, 0, 10)], [ring(20, 20, 10)]])).toBe(false);
    expect(await inside(5, 5, null)).toBe(false);
    expect(await inside(5, 5, [[ring(0, 0, 10).slice(0, 2)]])).toBe(false);

    const links = async (): Promise<string[]> =>
      (await driver<{ remote_id: string; area_id: string }[]>('links')).map(
        (link) => `${link.remote_id}:${link.area_id}`,
      );
    const synced = ['P-1:D-1', 'P-2:D-1', 'P-2:D-2', 'P-3:D-1', 'P-4:D-1', 'P-5:D-1', 'P-6:D-1'];
    expect(await links()).toEqual(synced);
    // The area page and its card count by the links: Norrmalm holds P-2 by outline alone.
    const norrmalm = await page(await permalink('area', 'D-2'));
    expect(norrmalm.body).toContain('Bostäder i Norrmalm');
    expect(norrmalm.body).toContain('Kungsgatan 2');
    expect(norrmalm.body).not.toContain('Kungsgatan 1');
    expect((await page('/?post_type=core_area')).body).toContain('1 bostad till salu');

    // Norrmalm redrawn far away: P-2 leaves it; then P-1 moves into the new outline and joins it.
    const far = [[ring(18.5, 59.6, 0.1)]];
    crm.put('area', 'D-2', {
      district_id: 'D-2',
      district_name: 'Norrmalm',
      branch_id: 'B-1',
      lkf: '0180',
      outline: far,
    });
    await poll();
    await site.trigger('delta');
    expect(await links()).toEqual(synced.filter((link) => link !== 'P-2:D-2'));
    crm.put('property', 'P-1', listing('P-1', { ...P1, lat: 59.65, lng: 18.55 }));
    await poll();
    await site.trigger('delta');
    expect(await links()).toContain('P-1:D-2');
    expect(await links()).not.toContain('P-2:D-2');

    // A plugin update: the first request after it reindexes, links the CRM's own areas in that
    // request, and rebuilds the outlines' links in the background from the stored records.
    const emptied = await wp(
      'eval',
      'global $wpdb; $wpdb->query("TRUNCATE TABLE " . core_client_links_table()); update_option("core_client_db_version", "0.4.4"); echo $wpdb->get_var("SELECT COUNT(*) FROM " . core_client_links_table());',
    );
    expect(emptied.stdout.trim()).toBe('0');
    expect((await page('/')).status).toBe(200);
    expect(await links()).toEqual(synced.filter((link) => link !== 'P-2:D-2'));
    const run = await driver<{ processed: number }>('backstop');
    expect(run.processed).toBeGreaterThan(0);
    const rebuilt = [
      'P-1:D-1',
      'P-1:D-2',
      ...synced.filter((link) => !link.startsWith('P-1:') && link !== 'P-2:D-2'),
    ];
    expect(await links()).toEqual(rebuilt);
    // The rebuild hands over from batch to batch by the last post id it reached (two homes a batch here), so a home at a batch's edge is not skipped.
    await wp('eval', 'global $wpdb; $wpdb->query("TRUNCATE TABLE " . core_client_links_table());');
    expect((await driver<{ linked: number }>('rebuild', '2')).linked).toBe(2);
    expect((await driver<{ processed: number }>('backstop')).processed).toBeGreaterThan(0);
    expect(await links()).toEqual(rebuilt);

    // Back as first put, for the tests that follow.
    crm.put('area', 'D-2', {
      district_id: 'D-2',
      district_name: 'Norrmalm',
      branch_id: 'B-1',
      lkf: '0180',
      outline: NORRMALM,
    });
    crm.put('property', 'P-1', listing('P-1', P1));
    await poll();
    await site.trigger('delta');
    expect(await links()).toEqual(synced);
  });

  it('renders a property page from display and data: hero, facts, viewings, agents, sections, map', async () => {
    const { status, body } = await page(await permalink('property', 'P-3'));
    expect(status).toBe(200);
    expect(body).toContain('k-hero__title--left">Kungsgatan 3</h1>');
    expect(body).toContain('Utgångspris');
    expect(body).toContain('5 000 000 kr');
    expect(body).toContain('k-label--bright">Vasastan</p>');
    expect(body).toContain('Ljus trea med balkong.');
    expect(body).toContain('<li class="k-chip">4 rum</li>');
    expect(body).toContain('<li class="k-chip">Bostadsrätt</li>');
    // Every viewing is on the page; the one that is over is hidden at render, and the script keeps that fresh.
    expect(body).toContain('<div class="k-viewings" data-viewings data-limit="0">');
    expect(body).toContain('Föranmälan krävs');
    expect(body).toContain('Visningen som var');
    expect(body).toMatch(/<div class="k-viewing" data-viewing data-until="[^"]+" hidden>/);
    expect(body.match(/<a class="k-button" href="#k-interest">Boka här<\/a>/g)).toHaveLength(1);
    // Without a viewing, the box's button takes the visitor to the agent's contact (Patric, 2026-10-04).
    expect(body).toContain('<a class="k-button" href="#k-agents">Kontakta oss</a>');
    expect(body).toContain('<div class="k-property__contact" id="k-agents">');
    // The bids, latest first, the cancelled one marked, and the highest standing bid from display (R-008).
    expect(body).toContain('<span class="k-label">Högsta bud</span><strong>5 100 000 kr</strong>');
    expect(body.indexOf('5 300 000 kr')).toBeLessThan(body.indexOf('5 050 000 kr'));
    expect(body).toContain('<li class="k-bid k-bid--cancelled">');
    // The selling heading stands where "Om bostaden" would; the first agent is the responsible one.
    expect(body).toContain('<h2 class="k-heading">Högst upp med balkong i söderläge</h2>');
    expect(body).not.toContain('Om bostaden');
    expect(body).toContain('Ansvarig mäklare');
    expect(body).toContain('Kontakta även');
    expect(body.indexOf('Anna Andersson')).toBeLessThan(body.indexOf('Bertil Berg'));
    expect(body).toContain('070-123 45 67');
    // The fact tables start closed (Patric, 2026-10-03).
    expect(body).toContain('class="k-accordion__item"');
    expect(body).not.toContain('k-accordion__item is-open');
    expect(body).toContain('class="k-accordion__button" type="button" aria-expanded="false"');
    expect(body).toContain('class="k-accordion__panel"><div class="k-accordion__inner">');
    // The hero and every gallery photo open the full-screen slider, with the files at full width.
    expect(body).toContain('k-hero--property" data-lightbox="0"');
    // The hero slides every photo (not the plan) and swipes; the plan comes last in every gallery.
    expect(body).toContain('data-hero-slider data-hero-swipe');
    expect(body.match(/class="swiper-slide k-hero__slide" data-index="/g)).toHaveLength(2);
    expect(body).toContain(
      '&quot;https://img.test/P-3-2_1920.jpg&quot;,&quot;https://img.test/P-3-plan_1920.jpg&quot;,&quot;https://img.test/P-3-plan2_1920.jpg&quot;]',
    );
    // Two plans slide with dots, each file in every CDN width so a dense screen gets a sharp one.
    expect(body).toContain('<div class="swiper k-plan__slider" data-plan-slider');
    expect(body.match(/class="k-plan__figure swiper-slide"/g)).toHaveLength(2);
    expect(body).toContain('class="swiper-pagination k-plan__dots"');
    expect(body).toContain('srcset="https://img.test/P-3-plan2_480.jpg 480w');
    expect(body).toContain('<figcaption>Plan 2</figcaption>');
    // The documents and the links as one list with an icon each, the duplicated address once.
    expect(body).toContain('>Dokument och länkar<');
    expect(body.match(/class="k-docs__item"/g)).toHaveLength(4); // the home's one document and the association's, and the two links
    expect(body).toContain('<span class="k-docs__name">Stadgar</span>');
    expect(body).toContain(
      'href="https://docs.test/arsredovisning.pdf" target="_blank" rel="noopener"><svg class="k-docs__icon"',
    );
    expect(body).toContain('<span class="k-docs__name">Föreningens hemsida</span>');
    expect(body).not.toContain('Hemsidan igen');
    expect(body).not.toContain('>Dokument<');
    expect(body).toContain('data-images="[&quot;https://img.test/P-3-1_1920.jpg&quot;');
    expect(body).toContain('data-lightbox="1"');
    // The page title and the sharing tags, as the master site carries them.
    expect(body).toContain('<title>Kungsgatan 3 - ');
    expect(body).toContain('<meta property="og:title" content="Kungsgatan 3 - ');
    expect(body).toContain('<meta property="og:image" content="https://img.test/P-3-1_1200.jpg">');
    expect(body).toContain('<meta name="description" content="Ljus trea med balkong.">');
    expect(body).toContain('<meta property="og:type" content="article">');
    // The master's address row: street, postal code and city with spaces only (R-013, question 92).
    expect(body).toContain('<dt>Adress</dt><dd>Kungsgatan 3 111 22 Stockholm</dd>');
    expect(body).toContain('class="k-gallery__item');
    // The phone's full-height photo slider before the grid, every photo a slide, and the hero's files sized for a portrait screen.
    expect(body).toContain('<div class="swiper k-photos" data-photo-slider');
    expect(body.match(/class="swiper-slide k-photos__slide"/g)).toHaveLength(4);
    expect(body).toContain('sizes="(max-width: 767px) 250vw, 100vw"');
    expect(body).toContain('data-map data-lat="');
    // The interest form is a dummy that names the listing (question 105 open): it posts nowhere.
    expect(body).toContain('data-subject="Kungsgatan 3"');
    expect(body).not.toContain('kowboy/v1/lead');
    // The header lies over the hero, with the bright logotype.
    expect(body).toContain('k-has-hero');
  });

  it('shows a sold property with its final price as "Slutpris", and no viewings', async () => {
    const { body } = await page(await permalink('property', 'P-4'));
    expect(body).toContain('Slutpris');
    expect(body).toContain('3 325 000 kr');
    expect(body).not.toContain('Visningar');
    expect(body).not.toContain('Budgivning');
    // No selling heading: the label stands, and the one agent is the responsible one.
    expect(body).toContain('<p class="k-label">Om bostaden</p>');
    expect(body).toContain('Ansvarig mäklare');
    expect(body).not.toContain('Kontakta även');
  });

  it('renders an association page with its rows, documents and homes, and answers the list parameters', async () => {
    const association = await page(await permalink('association', 'A-1'));
    expect(association.status).toBe(200);
    expect(association.body).toContain('<h1 class="k-section__title">Brf Solgården</h1>');
    expect(association.body).toContain('<p class="k-label">Bostadsrättsförening</p>');
    expect(association.body).toContain(
      '<dt>Allmänt om föreningen</dt><dd>En trevlig förening.</dd>',
    );
    expect(association.body).toContain('<dt>Organisationsnummer</dt><dd>769600-1234</dd>');
    expect(association.body).toContain('href="https://docs.test/stadgar.pdf"');
    expect(association.body).toContain('href="mailto:info@brfsolgarden.test"');
    // Its homes: P-3 names the association, no other home does.
    expect(association.body).toContain('Bostäder i Brf Solgården');
    expect(association.body.match(/<article class="k-card/g)).toHaveLength(1);
    expect(association.body).toContain('Kungsgatan 3');
    // The home's page keeps the association's rows.
    expect((await page(await permalink('property', 'P-3'))).body).toContain(
      '<dt>Namn</dt><dd>Brf Solgården</dd>',
    );
    // The parameters a list takes, through the endpoint that hands them on untouched: association, office, min and max price, min and max living space.
    const all = await reload({ entity: 'property', status: 'active,pre' });
    expect(
      (await reload({ entity: 'property', status: 'active,pre', association: 'A-1' })).total,
    ).toBe(1);
    expect((await reload({ entity: 'property', status: 'active,pre', office: 'B-1' })).total).toBe(
      all.total,
    );
    const cheap = await reload({ entity: 'property', status: 'active,pre', max_price: '5000000' });
    const dear = await reload({ entity: 'property', status: 'active,pre', min_price: '5000001' });
    expect(cheap.total + dear.total).toBe(all.total);
    expect(cheap.total).toBeGreaterThan(0);
    expect(dear.total).toBeGreaterThan(0);
    const exact = await reload({
      entity: 'property',
      status: 'active,pre',
      min_living_space: '82',
      max_living_space: '82',
    });
    expect(exact.total).toBeGreaterThan(0);
    expect(exact.total).toBeLessThan(all.total);
    expect(exact.html).toContain('82');
  });

  it('keeps a kind of record off the site when its publishing is off, and lists it read-only under one menu', async () => {
    const area = await permalink('area', 'D-1');
    expect((await page(area)).status).toBe(200);
    await driver('option', 'core_client_publish_area "0"');
    try {
      expect((await page(area)).status).toBe(404);
      expect((await reload({ entity: 'area' })).total).toBe(0);
      expect((await page('/?post_type=core_area')).status).toBe(404);
    } finally {
      await driver('option', 'core_client_publish_area null');
    }
    expect((await page(area)).status).toBe(200);
    // The post types: no adding, editing or deleting from the admin, all under the Kowboy Estates menu.
    const { stdout } = await wp(
      'eval',
      'echo json_encode(array_map(fn ($type) => [$type->label, $type->show_in_menu, $type->cap->create_posts, $type->cap->edit_post, $type->cap->delete_post], array_map("get_post_type_object", ["core_property", "core_association"])));',
    );
    expect(JSON.parse(stdout.trim())).toEqual([
      ['Properties', 'core-client', 'do_not_allow', 'do_not_allow', 'do_not_allow'],
      ['Associations', 'core-client', 'do_not_allow', 'do_not_allow', 'do_not_allow'],
    ]);
    // Even the administrator may only read a record (WordPress maps edit_post past the type's caps).
    const caps = await wp(
      'eval',
      '$p = get_posts(["post_type" => "core_property", "numberposts" => 1])[0]; wp_set_current_user(1); echo json_encode([current_user_can("edit_post", $p->ID), current_user_can("delete_post", $p->ID), current_user_can("read_post", $p->ID)]);',
    );
    expect(JSON.parse(caps.stdout.trim())).toEqual([false, false, true]);
  });

  it('renders agent, office and area pages with their lists inside the same view', async () => {
    const agent = await page(await permalink('agent', 'S-1'));
    expect(agent.status).toBe(200);
    expect(agent.body).toContain('<h1 class="k-section__title">Anna Andersson</h1>');
    expect(agent.body).toContain('Säljare på Kungsgatan 1');
    expect(agent.body.match(/<article class="k-card/g)).toHaveLength(4); // P-1, P-3, P-4, P-5 are Anna's; P-2 is Bertil's
    // The list carries the status tabs like the home page's, and a card with several photos is a slider the link leaves free.
    expect(agent.body).toContain('class="k-tabs"');
    expect(agent.body).toContain('<article class="k-card k-card--slider" data-card-url="');
    // A card names the area, not the tenure, and carries no fee (Patric, 2026-10-03).
    expect(agent.body).toContain('<span class="k-card__area">Vasastan</span>');
    expect(agent.body).not.toContain('k-card__tenure');
    expect(agent.body).not.toContain('Avgift');
    // The footer's menu ends with the areas archive.
    expect(agent.body).toContain('>Områden</a>');
    // The title, and the footer's form on every page, with the fields' names as placeholders.
    expect(agent.body).toContain('<title>Anna Andersson - ');
    expect(agent.body).toContain('<h2 class="k-lead__title">Ska du sälja din bostad?</h2>');
    expect(agent.body).toContain('placeholder="Förnamn"');
    expect(agent.body).not.toContain('k-field__label');

    const office = await page(await permalink('office', 'B-1'));
    expect(office.body).toContain('<h1 class="k-section__title">Kowboy Mäkleri</h1>');
    expect(office.body).toContain('Storgatan 1, Stockholm');
    expect(office.body).toContain('Bertil Berg');

    // An area's page opens with a hero (its listings' photos: the area has none) and lists its homes.
    const area = await page(await permalink('area', 'D-1'));
    expect(area.body).toContain('k-hero--area');
    expect(area.body).toContain('data-hero-slider');
    expect(area.body).toContain('k-hero__title--left">Vasastan</h1>');
    // The kommun over the title, named from the area's LKF code 018001 by the plugin's table.
    expect(area.body).toContain('k-label--bright">Stockholm</p>');
    expect(area.body).toContain('Bostäder i Vasastan');
    expect(area.body).toContain('k-has-hero');
    // The areas archive: cards like the properties', the placeholder when the area has no picture.
    // The associations archive: cards in the areas' shape, with the placeholder and the count for sale.
    const associations = await page('/?post_type=core_association');
    expect(associations.status).toBe(200);
    expect(associations.body).toContain('<h2 class="k-section__title">Föreningar</h2>');
    expect(associations.body).toContain(
      '<article class="k-card k-card--area k-card--association" data-card-url="',
    );
    expect(associations.body).toContain('<span class="k-card__area">Förening</span>');
    expect(associations.body).toContain('<span class="k-card__street">Brf Solgården</span>');
    expect(associations.body).toContain('placeholder.svg');
    expect(associations.body).not.toContain('k-paging'); // two associations, one page
    // Page numbers, not "Visa fler": one card a page makes two pages, the second as WordPress's own /page/2/.
    const paged = await wp(
      'eval',
      'echo core_client_list(["entity" => "association", "per_page" => 1, "page" => 2, "shadow" => false])["html"];',
    );
    expect(paged.stdout).toContain('<nav class="k-paging" aria-label="Sidor">');
    expect(paged.stdout).toContain(
      '<span aria-current="page" class="page-numbers current">2</span>',
    );
    expect(paged.stdout).toMatch(/page-numbers" href="[^"]*\/">1</);
    expect(paged.stdout).not.toContain('Visa fler');
    const areas = await page('/?post_type=core_area');
    expect(areas.body).toContain('<article class="k-card k-card--area" data-card-url="');
    // The card's preheader is the kommun from the LKF code (Patric, 2026-10-04).
    expect(areas.body).toContain('k-card__area">Stockholm</span>');
    expect(areas.body).toContain('placeholder.svg');
    expect(areas.body).toContain('<span class="k-card__street">Vasastan</span>');
    expect(areas.body).toContain('bostäder till salu');

    // The agents in the CRM's order (the staff list's order numbers), not by name.
    const agents = await page('/?post_type=core_agent');
    expect(agents.body.match(/<article class="k-agent-card">/g)).toHaveLength(2);
    expect(agents.body.indexOf('Bertil Berg')).toBeLessThan(agents.body.indexOf('Anna Andersson'));
    // An agent the CRM keeps out of the staff list, by either toggle, is in no list, but a home's page shows them.
    expect(agents.body).not.toContain('Cecilia Dold');
    expect(agents.body).not.toContain('David Dold');
    const sold = await page(await permalink('property', 'P-5'));
    expect(sold.body).toContain('Cecilia Dold');
    expect(sold.body).toContain('David Dold');
    expect((await page(await permalink('agent', 'S-3'))).status).toBe(200);
  });

  it('lets the site add its own agents and offices in the admin, lists them with the CRM’s, keeps them through a rebuild, and locks the CRM’s', async () => {
    type Typed = { post_id: number; id: string; permalink: string; data: Record<string, unknown> };
    const typed = (spec: Record<string, unknown>): Promise<Typed> =>
      driver<Typed>('typed', JSON.stringify(spec));
    const office = await typed({
      datatype: 'office',
      post: { post_title: 'Kowboy Norr', post_status: 'publish' },
      fields: {
        address: 'Norra vägen 2, 111 22 Stockholm',
        phone: '08-100 200',
        email: 'norr@kowboy.test',
        description: 'Vårt norra kontor.',
      },
    });
    const erik = await typed({
      datatype: 'agent',
      post: { post_title: 'Erik Egen', post_status: 'publish' },
      fields: {
        title: 'Mäklare',
        email: 'erik@kowboy.test',
        phone: '+46 70 111 22 33',
        description: 'Erik är ny.',
        reviews: 'Toppen | Köpare på Kungsgatan',
        visible: '1',
        offices: { 'B-1': { on: '1', order: '0', visible: '1' } },
      },
    });
    const fia = await typed({
      datatype: 'agent',
      post: { post_title: 'Fia Ny', post_status: 'publish' },
      fields: {
        title: 'Assistent',
        visible: '1',
        offices: { [office.id]: { on: '1', order: '', visible: '1' } },
      },
    });
    const gun = await typed({
      datatype: 'agent',
      post: { post_title: 'Gun Gömd', post_status: 'publish' },
      fields: { title: 'Koordinator', visible: '', offices: {} },
    });
    const typedPosts = [office, erik, fia, gun].map((one) => one.post_id);
    try {
      // The record under the universal names, the id behind the site's prefix, the address like every record's (101).
      expect(office.id).toBe(`s${office.post_id}`);
      expect(pathOf(office.permalink)).toBe(`/?core_office=kowboy-norr-s${office.post_id}`);
      expect(pathOf(erik.permalink)).toBe(`/?core_agent=erik-egen-s${erik.post_id}`);
      expect(office.data).toMatchObject({
        name: 'Kowboy Norr',
        display: { address_line: 'Norra vägen 2, 111 22 Stockholm' },
        phone: { number: '08100200', display: '08-100 200' },
        email: 'norr@kowboy.test',
      });
      expect(erik.data).toMatchObject({
        id: `s${erik.post_id}`,
        name: 'Erik Egen',
        title: 'Mäklare',
        email: 'erik@kowboy.test',
        phones: { mobile: { number: '+46701112233', display: '+46 70 111 22 33' }, public: null },
        image: null,
        office_ids: ['B-1'],
        offices: [{ office_id: 'B-1', order: 0, is_visible_in_staff_list: true, phone: null }],
        reviews: [{ text: 'Toppen', author: 'Köpare på Kungsgatan' }],
        is_visible_in_staff_list: true,
      });
      expect(fia.data).toMatchObject({ offices: [{ office_id: office.id, order: null }] });
      // The agents page: Erik first (order 0), Bertil (1), Anna (2), then Fia without a number, by name; Gun is hidden, her page answers.
      const agents = await page('/?post_type=core_agent');
      expect(agents.body.match(/<article class="k-agent-card">/g)).toHaveLength(4);
      const at = (name: string): number => agents.body.indexOf(name);
      expect(at('Erik Egen')).toBeLessThan(at('Bertil Berg'));
      expect(at('Bertil Berg')).toBeLessThan(at('Anna Andersson'));
      expect(at('Anna Andersson')).toBeLessThan(at('Fia Ny'));
      expect(agents.body).not.toContain('Gun Gömd');
      expect((await page(pathOf(gun.permalink))).status).toBe(200);
      // A card shows the title alone, never an office name (Patric, 2026-10-03).
      expect(agents.body).toContain('<p class="k-agent-card__title">Mäklare</p>');
      expect(agents.body).toContain('<p class="k-agent-card__title">Fastighetsmäklare</p>');
      // Erik among the CRM office's staff; Fia on the typed office's page, with its address line as typed.
      expect((await page(await permalink('office', 'B-1'))).body).toContain('Erik Egen');
      const norr = await page(pathOf(office.permalink));
      expect(norr.body).toContain('<h1 class="k-section__title">Kowboy Norr</h1>');
      expect(norr.body).toContain('Norra vägen 2, 111 22 Stockholm');
      expect(norr.body).toContain('Fia Ny');
      const erikPage = await page(pathOf(erik.permalink));
      expect(erikPage.body).toContain('Erik är ny.');
      expect(erikPage.body).toContain('Köpare på Kungsgatan');
      // The admin: an administrator and an editor edit and delete the typed agent and not the CRM's, an author neither;
      // agents and offices can be added, properties not; the Source column says whose a record is; the CRM record's
      // edit screen is answered with the plugin's own sentence and 403; the form lists every office, published or not.
      const caps = await wp(
        'eval',
        `global $wpdb; require_once ABSPATH . "wp-admin/includes/user.php";
        $crm = (int) $wpdb->get_var("SELECT post_id FROM " . core_client_index_table() . " WHERE remote_id = 'S-1'");
        $editor = wp_insert_user(["user_login" => "editor-" . wp_generate_password(6, false), "user_pass" => wp_generate_password(), "role" => "editor"]);
        $author = wp_insert_user(["user_login" => "author-" . wp_generate_password(6, false), "user_pass" => wp_generate_password(), "role" => "author"]);
        $can = function (int $user, string $cap, int $post = 0): bool { wp_set_current_user($user); return $post > 0 ? current_user_can($cap, $post) : current_user_can($cap); };
        $died = null;
        $handler = function ($message, $title, $args) use (&$died) { $died = [$message, $args["response"] ?? null]; };
        add_filter("wp_die_handler", fn () => $handler);
        wp_set_current_user(1); $_GET["post"] = $crm; do_action("load-post.php");
        update_option("core_client_publish_office", "0");
        $offices = array_column(core_client_site_offices(), "id");
        delete_option("core_client_publish_office");
        $out = [
          $can(1, "edit_post", $crm), $can(1, "delete_post", $crm), $can(1, "edit_post", ${erik.post_id}), $can(1, "delete_post", ${erik.post_id}),
          $can($editor, "edit_post", ${erik.post_id}), $can($editor, "delete_post", ${erik.post_id}), $can($editor, "edit_post", $crm), $can($author, "edit_post", ${erik.post_id}),
          $can(1, get_post_type_object("core_agent")->cap->create_posts), $can($editor, get_post_type_object("core_office")->cap->create_posts), $can($author, get_post_type_object("core_agent")->cap->create_posts),
          get_post_type_object("core_property")->cap->create_posts, core_client_source_label($crm), core_client_source_label(${erik.post_id}), $died, $offices,
        ];
        wp_delete_user($editor); wp_delete_user($author);
        echo json_encode($out);`,
      );
      expect(JSON.parse(caps.stdout.trim())).toEqual([
        false,
        false,
        true,
        true,
        true,
        true,
        false,
        false,
        true,
        true,
        false,
        'do_not_allow',
        'The CRM (edited there)',
        'This site',
        ['This record comes from the CRM and is edited there. This site only shows it.', 403],
        expect.arrayContaining(['B-1', office.id]),
      ]);
      // A rebuild (everything pulled again from the start) keeps the site's own records and the CRM's.
      await site.trigger('forcerefresh');
      expect((await site.status()).last_error).toBeNull();
      const ids = (await driver<{ remote_id: string }[]>('items', 'agent')).map(
        (one) => one.remote_id,
      );
      expect(ids).toEqual(expect.arrayContaining(['S-1', 'S-2', erik.id, fia.id, gun.id]));
      expect(
        (await page('/?post_type=core_agent')).body.match(/<article class="k-agent-card">/g),
      ).toHaveLength(4);
      // The rebuild a plugin update runs keeps them too, with the same address; the id alone and an
      // old address answer 301 to the current page, and a new name gives a new address.
      await wp(
        'eval',
        `global $wpdb; $wpdb->update($wpdb->posts, ["post_name" => "wrong"], ["ID" => ${erik.post_id}]); clean_post_cache(${erik.post_id}); core_client_reindex();`,
      );
      expect(await driver('items', 'agent')).toEqual(
        expect.arrayContaining([expect.objectContaining({ remote_id: erik.id })]),
      );
      const erikNow = await typed({ datatype: 'agent', post: { ID: erik.post_id } });
      expect(pathOf(erikNow.permalink)).toBe(pathOf(erik.permalink));
      for (const name of [erik.id, `erik-gammal-${erik.id}`]) {
        const response = await fetch(`${siteUrl}/?core_agent=${name}`, { redirect: 'manual' });
        expect(response.status).toBe(301);
        expect(response.headers.get('location')).toContain(`core_agent=erik-egen-s${erik.post_id}`);
      }
      const renamed = await typed({
        datatype: 'agent',
        post: { ID: erik.post_id, post_title: 'Erik Ensam' },
      });
      expect(pathOf(renamed.permalink)).toBe(`/?core_agent=erik-ensam-s${erik.post_id}`);
      expect(renamed.data).toMatchObject({
        name: 'Erik Ensam',
        title: 'Mäklare',
        email: 'erik@kowboy.test',
      });
      const oldAddress = await fetch(`${siteUrl}${pathOf(erik.permalink)}`, { redirect: 'manual' });
      expect(oldAddress.status).toBe(301);
      expect(oldAddress.headers.get('location')).toContain(`erik-ensam-s${erik.post_id}`);
      // A draft is not on the site and keeps its fields; published again, it is back.
      await typed({ datatype: 'agent', post: { ID: fia.post_id, post_status: 'draft' } });
      expect((await page('/?post_type=core_agent')).body).not.toContain('Fia Ny');
      expect((await page(pathOf(office.permalink))).body).not.toContain('Fia Ny');
      const kept = (
        await driver<{ remote_id: string; data: { title: string } }[]>('items', 'agent')
      ).find((one) => one.remote_id === fia.id);
      expect(kept?.data.title).toBe('Assistent');
      await typed({ datatype: 'agent', post: { ID: fia.post_id, post_status: 'publish' } });
      expect((await page('/?post_type=core_agent')).body).toContain('Fia Ny');
      // A post published without the form (a quick edit, wp post create) is a typed record from its title alone;
      // its address is URL-safe: accents to base letters, apostrophes, parentheses and marks dropped (Patric, 2026-10-04).
      const hans = await typed({
        datatype: 'agent',
        post: { post_title: "Åsa O'Brien (Söder) & Co é", post_status: 'publish' },
      });
      typedPosts.push(hans.post_id);
      expect(hans.id).toBe(`s${hans.post_id}`);
      expect(pathOf(hans.permalink)).toBe(`/?core_agent=asa-obrien-soder-co-e-s${hans.post_id}`);
      expect(hans.data).toMatchObject({ name: "Åsa O'Brien (Söder) & Co é", image: null });
      // A slug never loses its id to the post's 200 characters, however long the words.
      const long = await wp(
        'eval',
        'echo core_client_slug("property", (object) ["status" => (object) ["id" => "active"], "address" => (object) ["city" => "Stockholm", "area_name" => str_repeat("Långgatan ", 30), "street" => str_repeat("Långgatan ", 30)]], "P-1");',
      );
      expect(long.stdout.trim().length).toBeLessThanOrEqual(200);
      expect(long.stdout.trim()).toMatch(/^till-salu-stockholm-langgatan-langgatan-.*-p-1$/);
      // Deleted in the admin, a typed record is gone from the index too.
      await wp('eval', `wp_delete_post(${gun.post_id}, true);`);
      expect(
        (await driver<{ remote_id: string }[]>('items', 'agent')).map((one) => one.remote_id),
      ).not.toContain(gun.id);
    } finally {
      await wp(
        'eval',
        `foreach ([${typedPosts.join(', ')}] as $id) { wp_delete_post($id, true); }`,
      );
    }
    expect(
      (await page('/?post_type=core_agent')).body.match(/<article class="k-agent-card">/g),
    ).toHaveLength(2);
  });

  it('makes the demo pages from the section blocks on activation, and renders them', async () => {
    const { pages, front } = await driver<{ pages: Record<string, string | null>; front: number }>(
      'demo-pages',
    );
    expect(Object.values(pages).every((url) => typeof url === 'string')).toBe(true);
    expect(front).toBeGreaterThan(0);
    const home = await page('/');
    expect(home.status).toBe(200);
    expect(home.body).toContain('k-has-hero');
    expect(home.body).toContain('k-hero--tall');
    // The page has no pictures of its own, so the hero slides the newest listings' photos.
    expect(home.body).toContain('data-hero-slider');
    expect(home.body).toContain('class="k-hero__image"');
    expect(home.body).toContain('Rätt timing ger bättre affärer');
    expect(home.body).toContain('<span class="k-figure__value">150+</span>');
    expect(home.body.match(/<article class="k-agent-card">/g)).toHaveLength(2);
    expect(home.body).toContain('class="k-list"');
    expect(home.body).toContain('<h2 class="k-lead__title">Ska du sälja din bostad?</h2>');
    expect(home.body.match(/k-lead__title/g)).toHaveLength(1); // the footer's form, once
    expect(home.body).toContain('class="k-footer"');
    expect(home.body).toContain('<title>Hem - ');
    expect(home.body).toContain('<meta property="og:type" content="website">');
    const forSale = await page(pathOf(pages['till-salu']!));
    expect(forSale.body).toContain('Hitta din nya bostad');
    expect(forSale.body).toContain('k-hero--with-form');
    expect(forSale.body).toContain('name="max_price"');
    // The search card carries the plugin's place search box, with the places of the homes for sale and coming.
    expect(forSale.body).toContain('data-place-search');
    expect(forSale.body).toContain('<option value="areas:D-2">Norrmalm · Stockholm</option>');
    const about = await page(pathOf(pages['om-oss']!));
    expect(about.body).toContain('<span class="k-feature__badge">01</span>');
    // The testimonials are the agents' reviews from Core, not the block's own quotes.
    expect(about.body).toContain('data-testimonials');
    expect(about.body).toContain('Mycket nöjd.');
    expect(about.body).not.toContain('Sara är professionell');
    // A page without a hero gets the solid header.
    const plain = await page(await permalink('agent', 'S-1'));
    expect(plain.body).toContain('k-no-hero');
  });

  it('shows the theme options: the contact details in the footer and the typography as variables', async () => {
    await wp('theme', 'mod', 'set', 'kowboy_address', 'Grimsbygatan 24A, Malmö');
    await wp('theme', 'mod', 'set', 'kowboy_display_size', '40');
    try {
      const { body } = await page('/');
      expect(body).toContain('Grimsbygatan 24A, Malmö');
      expect(body).toContain('--k-display-size:40px');
    } finally {
      await wp('theme', 'mod', 'remove', 'kowboy_address', 'kowboy_display_size');
    }
  });
});

describe('the plugin’s set machinery, with a set plugin', () => {
  it('lets a set plugin serve the views under another theme, and a copy in that theme override one of them', async () => {
    await driver('theme', 'twentytwentyone');
    await driver('option', 'core_client_template_set "fixture"');
    mkdirSync(THEME_OVERRIDES, { recursive: true });
    try {
      let { body } = await page('/?post_type=core_property');
      expect(body).toContain('<article class="fixture-card">Kungsgatan 3</article>');
      expect(body).not.toContain('class="k-card"');
      expect(body).toContain('fixture.css');
      writeFileSync(
        join(THEME_OVERRIDES, 'card-property.php'),
        '<?php ?><article class="theme-card"><?php echo esc_html((string) $item["address"]["street"]); ?></article>',
      );
      ({ body } = await page('/?post_type=core_property'));
      expect(body).toContain('<article class="theme-card">Kungsgatan 3</article>');
      expect(body).not.toContain('fixture-card');
    } finally {
      rmSync(THEME_OVERRIDES, { recursive: true, force: true });
      await driver('option', 'core_client_template_set ""');
      await driver('theme', 'kowboy-2026');
    }
  });

  it('registers the two list blocks in the plugin, renders them through the set’s views restricted to the picks, serves the picks to an editor only, and leaves the theme’s wrappers their background and text card', async () => {
    const registered = JSON.parse(
      (
        await wp(
          'eval',
          'echo json_encode(["blocks" => array_values(array_filter(array_keys(WP_Block_Type_Registry::get_instance()->get_all_registered()), fn (string $name): bool => str_starts_with($name, "core-client/") || str_starts_with($name, "kowboy/"))), "wrapper" => array_keys(WP_Block_Type_Registry::get_instance()->get_registered("kowboy/property-list")->attributes), "script" => wp_script_is("core-client-editor", "registered")]);',
        )
      ).stdout,
    ) as { blocks: string[]; wrapper: string[]; script: boolean };
    expect(registered.blocks).toEqual(
      expect.arrayContaining([
        'core-client/property-list',
        'core-client/agent-list',
        'kowboy/property-list',
        'kowboy/agents',
      ]),
    );
    expect(registered.script).toBe(true);
    // The theme's wrapper registers the plugin's list settings merged into its own.
    expect(registered.wrapper).toEqual(
      expect.arrayContaining([
        'title',
        'status',
        'perPage',
        'placeSearch',
        'agents',
        'areas',
        'offices',
        'background',
      ]),
    );

    // The plugin alone, under another theme with the fixture set: both blocks render through the
    // set's views (the set's stylesheet linked inside the root, as the site's setting says), the
    // homes of the picked agent or the picked area only, the agents of the picked office only.
    const blocks = [
      '<!-- wp:core-client/property-list {"status":"for_sale,coming","statusTabs":false,"agents":["S-2"]} /-->',
      '<!-- wp:core-client/property-list {"status":"for_sale,coming","statusTabs":false,"areas":["D-2"]} /-->',
      '<!-- wp:core-client/agent-list {"offices":["B-1"]} /-->',
      '<!-- wp:core-client/agent-list {"offices":["B-9"]} /-->',
    ].join('');
    const pageId = (
      await wp(
        'post',
        'create',
        '--post_type=page',
        '--post_status=publish',
        '--post_title=Blocken',
        `--post_content=${blocks}`,
        '--porcelain',
      )
    ).stdout.trim();
    const path = pathOf((await wp('post', 'url', pageId)).stdout.trim());
    await driver('theme', 'twentytwentyone');
    await driver('option', 'core_client_template_set "fixture"');
    try {
      const { body } = await page(path);
      // Bertil's two homes (one as the second agent), then Norrmalm's one by its outline: Kungsgatan 2 in both lists.
      expect(body.match(/<article class="fixture-card">/g)).toHaveLength(3);
      expect(body.match(/<article class="fixture-card">Kungsgatan 2<\/article>/g)).toHaveLength(2);
      expect(body).not.toContain('<article class="fixture-card">Kungsgatan 1</article>');
      expect(body.match(/<div class="fixture-agents">/g)).toHaveLength(2);
      expect(body.match(/<article class="fixture-agent">/g)).toHaveLength(2); // B-1's listed agents; B-9 has none
      expect(body).toContain('fixture.css');
      expect(body).not.toContain('k-card');
    } finally {
      await driver('option', 'core_client_template_set ""');
      await driver('theme', 'kowboy-2026');
    }
    // The theme's wrappers: the same settings inside the theme's section, with its background and
    // its text card, and the picks handed to the reload script, so the tabs and "Visa fler" stay restricted.
    const wrappers =
      '<!-- wp:kowboy/property-list {"status":"for_sale,coming","agents":["S-2"],"background":"subtle"} /--><!-- wp:kowboy/agents {"offices":["B-1"],"cardTitle":"Möt teamet"} /-->';
    await wp('post', 'update', pageId, `--post_content=${wrappers}`);
    const themed = await page(path);
    expect(themed.body).toContain('k-list-section--subtle');
    expect(themed.body.match(/<article class="k-card/g)).toHaveLength(2);
    expect(themed.body).toContain('&quot;agent&quot;:&quot;S-2&quot;');
    expect(themed.body.match(/<article class="k-agent-card">/g)).toHaveLength(2);
    expect(themed.body).toContain('<h3 class="k-info-card__title">Möt teamet</h3>');
    await wp('post', 'delete', pageId, '--force');

    // The picks: every record, hidden agents too, by a label that tells namesakes apart, for a
    // signed-in editor through WordPress's own dispatcher; a visitor is refused.
    const picks = (entity: string, user: number) =>
      driver<{ status: number; rows: { id: string; label: string }[] }>(
        'picks',
        `${entity} ${user}`,
      );
    expect((await picks('agent', 0)).status).toBe(401);
    const agents = await picks('agent', 1);
    expect(agents.status).toBe(200);
    expect(agents.rows.map((row) => `${row.id} ${row.label}`)).toEqual([
      'S-2 Bertil Berg · Kowboy Mäkleri',
      'S-1 Anna Andersson · Kowboy Mäkleri',
      'S-3 Cecilia Dold · Kowboy Mäkleri',
      'S-4 David Dold · Kowboy Mäkleri',
    ]);
    expect((await picks('area', 1)).rows).toEqual([
      { id: 'D-2', label: 'Norrmalm · Stockholm' },
      { id: 'D-1', label: 'Vasastan · Stockholm' },
    ]);
    expect((await picks('office', 1)).rows).toEqual([
      { id: 'B-1', label: 'Kowboy Mäkleri · Stockholm' },
    ]);
    expect((await fetch(`${siteUrl}/?rest_route=/core/v1/picks&entity=agent`)).status).toBe(401);
  });

  it('renders inside a shadow root by default, with the stylesheets linked inside, and on the page when the site turns it off', async () => {
    const { body } = await page(await permalink('property', 'P-1'));
    expect(body).toContain(
      '<core-view><template shadowrootmode="open"><link rel="stylesheet" href="',
    );
    expect(body).toContain('kowboy-2026-vendor.css');
    expect(body).toContain('kowboy-2026.css');
    // The list inside an agent page opens no second root.
    const agent = await page(await permalink('agent', 'S-1'));
    expect(agent.body.match(/<template shadowrootmode="open">/g)).toHaveLength(1);
    await driver('option', 'core_client_shadow_dom "0"');
    try {
      const plain = await page(await permalink('property', 'P-1'));
      expect(plain.body).not.toContain('<template shadowrootmode="open">');
      expect(plain.body).toContain("id='core-client-set-css'");
    } finally {
      await driver('option', 'core_client_shadow_dom null');
    }
  });

  it('names every page the way norbanmakleri.se does, ending in the id, and answers an id alone with 301 for every kind (101)', async () => {
    // The test site has plain permalinks, so the slug shows as the kind's query var; on a site
    // with pretty permalinks the same slug sits under the kind's path (/objekt/, /maklare/, ...).
    // Property: the site's list word for the status, then city, area, street, id; the others: name, id.
    expect(await permalink('property', 'P-3')).toBe(
      '/?core_property=kommande-stockholm-vasastan-kungsgatan-3-p-3',
    );
    expect(await permalink('property', 'P-1')).toBe(
      '/?core_property=till-salu-stockholm-vasastan-kungsgatan-1-p-1',
    );
    expect(await permalink('property', 'P-5')).toBe(
      '/?core_property=sold-stockholm-vasastan-kungsgatan-5-p-5',
    );
    expect(await permalink('agent', 'S-1')).toBe('/?core_agent=anna-andersson-s-1');
    expect(await permalink('office', 'B-1')).toBe('/?core_office=kowboy-makleri-b-1');
    expect(await permalink('area', 'D-1')).toBe('/?core_area=stockholm-vasastan-d-1');
    expect(await permalink('association', 'A-1')).toBe('/?core_association=brf-solgarden-a-1');
    // An agent by id alone, and by a slug from before a name change: 301 to the current page.
    for (const name of ['S-1', 'anna-svensson-S-1']) {
      const response = await fetch(`${siteUrl}/?core_agent=${name}`, { redirect: 'manual' });
      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toContain('core_agent=anna-andersson-s-1');
    }
  });

  it('shows a record’s JSON to anyone on ?debugpl', async () => {
    const path = await permalink('property', 'P-3');
    const debug = `${path}${path.includes('?') ? '&' : '?'}debugpl`;
    // Plain JSON under its own media type, without a sign-in (Patric, 2026-10-03): the browser shows it itself.
    const response = await fetch(`${siteUrl}${debug}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const json = (await response.json()) as {
      item: { address: { street: string } };
      raw: { blurb: string };
    };
    expect(json.item.address.street).toBe('Kungsgatan 3');
    expect(json.raw.blurb).toBe('Ljus trea med balkong.');
  });

  it('uses the active theme’s set when none is chosen, or when the chosen one is not there', async () => {
    await driver('option', 'core_client_template_set "no-such-set"');
    try {
      expect((await page('/?post_type=core_property')).body).toContain('class="k-list"');
    } finally {
      await driver('option', 'core_client_template_set ""');
    }
    const { body } = await page('/?post_type=core_property');
    expect(body).toContain('class="k-list"');
    expect(body).toContain('data-tab="for_sale">Till salu');
  });
});
