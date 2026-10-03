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
import { driver, siteUrl, start, stop, wp, WP_ROOT } from './test/site.js';

const THEME_OVERRIDES = join(WP_ROOT, 'wp-content', 'themes', 'twentytwentyone', 'core');

const soon = (hours: number): string => new Date(Date.now() + hours * 3_600_000).toISOString();

/** A listing as the fake polling CRM holds it: enough for a card and a page. */
const listing = (id: string, extra: Record<string, unknown>): Record<string, unknown> => ({
  object_id: id,
  stage: 'active',
  stage_label: 'Till salu',
  object_type: 'flat',
  street: `Kungsgatan ${id.replace(/\D/g, '')}`,
  postal_code: '111 22',
  city: 'Stockholm',
  district_name: 'Vasastan',
  districts: ['D-1'],
  price: 7_250_000,
  fee: 4_100,
  living_space: 82,
  rooms: 3,
  tenure: 'Bostadsrätt',
  price_text: 'utgångspris',
  blurb: 'Ljus trea med balkong.',
  branch_id: 'B-1',
  staff: ['S-1'],
  coop_id: null,
  images: [`https://img.test/${id}-1_1920.jpg`, `https://img.test/${id}-2_1920.jpg`],
  published_at: '2026-09-01T08:00:00.000Z',
  ...extra,
});

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

  crm.put('office', 'B-1', {
    branch_id: 'B-1',
    branch_name: 'Kowboy Mäkleri',
    email: 'hello@kowboy.test',
    street: 'Storgatan 1',
    city: 'Stockholm',
    lat: 59.33,
    lng: 18.06,
  });
  crm.put('agent', 'S-1', {
    staff_id: 'S-1',
    branch_id: 'B-1',
    full_name: 'Anna Andersson',
    title: 'Fastighetsmäklare',
    email: 'anna@kowboy.test',
    mobile: '070-123 45 67',
    photo: 'https://img.test/anna.jpg',
    bio: 'Anna har sålt bostäder sedan 2011.',
    reviews: [{ text: 'Mycket nöjd.', author: 'Säljare på Kungsgatan 1' }],
    order: 2,
  });
  crm.put('agent', 'S-2', {
    staff_id: 'S-2',
    branch_id: 'B-1',
    full_name: 'Bertil Berg',
    title: 'Mäklarassistent',
    order: 1,
  });
  // Two agents the CRM keeps out of the staff list, one by the record's toggle and one by the office's.
  crm.put('agent', 'S-3', {
    staff_id: 'S-3',
    branch_id: 'B-1',
    full_name: 'Cecilia Dold',
    title: 'Säljkoordinator',
    order: 3,
    visible: false,
  });
  crm.put('agent', 'S-4', {
    staff_id: 'S-4',
    branch_id: 'B-1',
    full_name: 'David Dold',
    title: 'Fastighetsmäklare',
    order: 4,
    visible: true,
    office_visible: false,
  });
  crm.put('association', 'A-1', {
    coop_id: 'A-1',
    coop_name: 'Brf Solgården',
    form: 'Bostadsrättsförening',
    corporate_number: '769600-1234',
    home_page: 'https://brfsolgarden.test/',
    apartments: 48,
    contact: {
      name: 'Styrelsen',
      phone: '08-123 45 67',
      mobile: null,
      email: 'info@brfsolgarden.test',
    },
    descriptions: { general_about_association: 'En trevlig förening.' },
    economy: { finances: 'God ekonomi.' },
    documents: [{ name: 'Stadgar', url: 'https://docs.test/stadgar.pdf' }],
  });
  crm.put('association', 'A-2', { coop_id: 'A-2', coop_name: 'Brf Månen' });
  crm.put('area', 'D-1', { district_id: 'D-1', district_name: 'Vasastan', branch_id: 'B-1' });
  crm.put('property', 'P-1', listing('P-1', { price: 7_250_000, rooms: 3, living_space: 82 }));
  crm.put(
    'property',
    'P-2',
    listing('P-2', {
      price: 3_100_000,
      rooms: 1.5,
      living_space: 41,
      staff: ['S-2'],
      district_name: 'Södermalm',
      city: 'Stockholm',
      published_at: '2026-09-10T08:00:00.000Z',
    }),
  );
  crm.put(
    'property',
    'P-3',
    listing('P-3', {
      stage: 'pre',
      stage_label: 'Kommande',
      coop_id: 'A-1',
      price: 5_000_000,
      rooms: 4,
      living_space: 110,
      viewings: [
        { starts_at: soon(48), ends_at: soon(49), comment: 'Föranmälan krävs', bookable: true },
        { starts_at: soon(-30), ends_at: soon(-29), comment: 'Visningen som var' },
      ],
      images: [
        'https://img.test/P-3-1_1920.jpg',
        'https://img.test/P-3-2_1920.jpg',
        { url: 'https://img.test/P-3-plan_1920.jpg', category: 'Planritning' },
        {
          url: 'https://img.test/P-3-plan2_1920.jpg',
          category: 'Planritning',
          description: 'Plan 2',
        },
      ],
      documents: [{ name: 'Årsredovisning 2025', url: 'https://docs.test/arsredovisning.pdf' }],
      links: [
        { name: 'Föreningens hemsida', url: 'https://brf.test/' },
        { name: 'Hemsidan igen', url: 'https://brf.test/' },
        { name: 'Energideklaration', url: 'https://docs.test/energi.pdf' },
      ],
      bidding_active: true,
      bids: [
        {
          placed_at: '2026-09-20T10:00:00.000Z',
          amount: 5_050_000,
          is_cancelled: false,
          alias: 'Budgivare 1',
        },
        {
          placed_at: '2026-09-21T10:00:00.000Z',
          amount: 5_100_000,
          is_cancelled: false,
          alias: 'Budgivare 2',
        },
        {
          placed_at: '2026-09-22T10:00:00.000Z',
          amount: 5_300_000,
          is_cancelled: true,
          alias: 'Budgivare 1',
        },
      ],
      heading: 'Högst upp med balkong i söderläge',
      staff: ['S-1', 'S-2'],
      lat: 59.34,
      lng: 18.05,
      published_at: '2026-09-12T08:00:00.000Z',
    }),
  );
  crm.put(
    'property',
    'P-4',
    listing('P-4', {
      stage: 'done',
      stage_label: 'Såld',
      price: 2_995_000,
      final_price: 3_325_000,
      sold_at: '2026-08-01T12:00:00.000Z',
    }),
  );
  crm.put(
    'property',
    'P-5',
    listing('P-5', {
      stage: 'done',
      stage_label: 'Såld',
      price: 4_000_000,
      final_price: 4_200_000,
      sold_at: '2026-08-15T12:00:00.000Z',
      staff: ['S-1', 'S-3', 'S-4'],
    }),
  );
  crm.put('property', 'P-6', listing('P-6', { project_id: 'PR-1', price: 9_000_000 }));
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
