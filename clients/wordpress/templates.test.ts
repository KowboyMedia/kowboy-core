// The template set "Kowboy 2026" and the plugin's template machinery against the real WordPress
// (test/site.ts) with records from the fake polling CRM through the real Core: the lists with
// their filters and reloads, the single pages, the override rule, the selector and shadow DOM.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { harness, TOKEN, type Harness } from '../../acceptance/harness.js';
import { fakePollingAdapter, poll } from '../../adapters/fake-polling/index.js';
import * as crm from '../../adapters/fake-polling/crm.js';
import { BELL_SECRET, CONNECTION, type ClientDriver } from '../sync-scenarios.js';
import { driver, siteUrl, start, stop, WP_ROOT } from './test/site.js';

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
  images: [`https://img.test/${id}-1.jpg`, `https://img.test/${id}-2.jpg`],
  published_at: '2026-09-01T08:00:00.000Z',
  ...extra,
});

let core: Harness;
let site: ClientDriver;

const page = async (path: string): Promise<{ status: number; body: string }> => {
  const response = await fetch(`${siteUrl}${path}`);
  return { status: response.status, body: await response.text() };
};

const reload = async (
  params: Record<string, string>,
): Promise<{ html: string; total: number; has_more: boolean }> => {
  const query = new URLSearchParams({ rest_route: '/core/v1/list', ...params });
  const response = await fetch(`${siteUrl}/?${query.toString()}`);
  expect(response.status).toBe(200);
  return (await response.json()) as { html: string; total: number; has_more: boolean };
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
  });
  crm.put('agent', 'S-2', {
    staff_id: 'S-2',
    branch_id: 'B-1',
    full_name: 'Bertil Berg',
    title: 'Mäklarassistent',
  });
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
      price: 5_000_000,
      rooms: 4,
      living_space: 110,
      viewings: [{ starts_at: soon(48), ends_at: soon(49), comment: 'Föranmälan krävs' }],
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
    expect(body).toContain('class="k26-list"');
    expect(body).toContain('name="max_price"');
    // For sale and coming, newest first; sold ones and a project's homes stay out.
    const streets = [...body.matchAll(/<h3>(Kungsgatan \d+)<\/h3>/g)].map((match) => match[1]);
    expect(streets).toEqual(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);
    expect(body).toContain('7 250 000 kr');
    expect(body).toContain('Avgift 4 100 kr');
    expect(body).not.toContain('kr/mån');
    expect(body).toContain('<li>Bostadsrätt</li>');
    expect(body).toContain('82 kvm');
    expect(body).toContain('Visning ');
    expect(body).toContain('kowboy-2026.css');
    expect(body).toContain('kowboy-2026.js');
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
    expect(first.html.match(/<article class="k26-card">/g)).toHaveLength(2);
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
    expect([...sold.html.matchAll(/<h3>(Kungsgatan \d+)<\/h3>/g)].map((match) => match[1])).toEqual(
      ['Kungsgatan 5', 'Kungsgatan 4'],
    );
    expect(sold.html).toContain('4 200 000 kr');
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
      1,
    );
    expect((await reload({ entity: 'property', office: 'B-1' })).total).toBe(5);
    expect((await reload({ entity: 'property', project: 'PR-1' })).total).toBe(1);
    expect((await reload({ entity: 'agent', office: 'B-1' })).total).toBe(2);
    expect(
      (await reload({ entity: 'property', status: 'active', sort: 'price_asc' })).html.indexOf(
        'Kungsgatan 2',
      ),
    ).toBeLessThan(
      (await reload({ entity: 'property', status: 'active', sort: 'price_asc' })).html.indexOf(
        'Kungsgatan 1',
      ),
    );
  });

  it('renders a property page from display and data: hero, facts, viewings, agents, sections, map', async () => {
    const { status, body } = await page(await permalink('property', 'P-3'));
    expect(status).toBe(200);
    expect(body).toContain('<h1>Kungsgatan 3</h1>');
    expect(body).toContain('Utgångspris');
    expect(body).toContain('5 000 000 kr');
    expect(body).toContain('<span class="k26-label">Kommande</span>');
    expect(body).toContain('<li>Vasastan</li>');
    expect(body).toContain('Ljus trea med balkong.');
    expect(body).toContain('<span>Rum</span><strong>4 rum</strong>');
    expect(body).toContain('<span>Typ</span><strong>Bostadsrätt</strong>');
    expect(body).toContain('Föranmälan krävs');
    expect(body).toContain('Anna Andersson');
    expect(body).toContain('070-123 45 67');
    expect(body).toContain('<details class="k26-section">');
    expect(body).toContain('<dt>Adress</dt><dd>Kungsgatan 3, 111 22 Stockholm</dd>');
    expect(body).toContain('class="k26-gallery__item"');
  });

  it('shows a sold property with its final price as "Slutpris", and no viewings', async () => {
    const { body } = await page(await permalink('property', 'P-4'));
    expect(body).toContain('Slutpris');
    expect(body).toContain('3 325 000 kr');
    expect(body).not.toContain('Visningar');
  });

  it('renders agent, office and area pages with their lists inside the same view', async () => {
    const agent = await page(await permalink('agent', 'S-1'));
    expect(agent.status).toBe(200);
    expect(agent.body).toContain('<h2>Anna Andersson</h2>');
    expect(agent.body).toContain('Kundomdömen');
    expect(agent.body).toContain('Säljare på Kungsgatan 1');
    expect(agent.body).toContain('Ett urval av mina objekt');
    expect(agent.body.match(/<article class="k26-card">/g)).toHaveLength(4); // P-1, P-3, P-4, P-5 are Anna's; P-2 is Bertil's

    const office = await page(await permalink('office', 'B-1'));
    expect(office.body).toContain('<h1>Kowboy Mäkleri</h1>');
    expect(office.body).toContain('Storgatan 1, Stockholm');
    expect(office.body).toContain('Bertil Berg');
    expect(office.body).toContain('maps.google.com');

    const area = await page(await permalink('area', 'D-1'));
    expect(area.body).toContain('<h1>Vasastan</h1>');
    expect(area.body).toContain('Experter på Vasastan');
    expect(area.body).toContain('Bostäder i Vasastan');

    const agents = await page('/?post_type=core_agent');
    expect(agents.body.match(/<article class="k26-agent-item">/g)).toHaveLength(2);
  });

  it('lets a copy in the theme override one view while every other view stays the set’s', async () => {
    mkdirSync(THEME_OVERRIDES, { recursive: true });
    writeFileSync(
      join(THEME_OVERRIDES, 'card-property.php'),
      '<?php ?><article class="theme-card"><?php echo esc_html((string) $item["address"]["street"]); ?></article>',
    );
    try {
      const { body } = await page('/?post_type=core_property');
      expect(body).toContain('<article class="theme-card">Kungsgatan 3</article>');
      expect(body).not.toContain('<article class="k26-card">');
      expect(body).toContain('class="k26-list"'); // the wrapper is still the set's
    } finally {
      rmSync(THEME_OVERRIDES, { recursive: true, force: true });
    }
  });

  it('renders inside a shadow root when the site asks for it, with the stylesheet linked inside', async () => {
    await driver('option', 'core_client_shadow_dom true');
    try {
      const { body } = await page(await permalink('property', 'P-1'));
      expect(body).toContain(
        '<core-view><template shadowrootmode="open"><link rel="stylesheet" href="',
      );
      expect(body).toContain('kowboy-2026.css');
      // The list inside an agent page opens no second root.
      const agent = await page(await permalink('agent', 'S-1'));
      expect(agent.body.match(/<template shadowrootmode="open">/g)).toHaveLength(1);
    } finally {
      await driver('option', 'core_client_shadow_dom false');
    }
  });

  it('uses the one installed set when none is chosen, or when the chosen one is not there', async () => {
    await driver('option', 'core_client_template_set "no-such-set"');
    try {
      expect((await page('/?post_type=core_property')).body).toContain('class="k26-list"');
    } finally {
      await driver('option', 'core_client_template_set ""');
    }
    expect((await page('/?post_type=core_property')).body).toContain('class="k26-list"');
    expect((await page('/?post_type=core_property')).body).toContain(
      'data-status="for_sale">Till salu',
    );
  });
});
