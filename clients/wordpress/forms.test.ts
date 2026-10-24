// The plugin's forms (docs/forms.md, "Built 2026-10-19"): its receivers carry the three forms
// through Core to the CRM and read a viewing's times, and nothing the site serves carries its
// token; the receiver keeps every form it sends, delivered or not, with the visitor's details and
// the outcome, for 30 days on its page "Formulär", and sends none again (Patric, 2026-10-19); a
// form that does not reach Core is tried twice more (question 166); and the page's switch turns
// the forms off, which takes a theme's window off the pages. Proved against the test Core and its
// fake CRM on the WordPress install of test/setup.sh, through the plugin's test theme.
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { harness, HUMAN_TOKEN, TOKEN, type Harness } from '../../acceptance/harness.js';
import { fakePollingAdapter, poll } from '../../adapters/fake-polling/index.js';
import * as crm from '../../adapters/fake-polling/crm.js';
import { BELL_SECRET, CONNECTION } from '../sync-scenarios.js';
import { fillTheCrm, soon } from './test/records.js';
import { driver, siteUrl, start, stop, wp } from './test/site.js';

let core: Harness;

/** What a gateway does not pass on: the connection's own headers. */
const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
  'expect',
]);

/** A visitor's interest in Kungsgatan 1, as a theme's window builds it. */
const interest = (): Record<string, unknown> => ({
  id: randomUUID(),
  kind: 'interest',
  person: {
    first_name: 'Anna',
    last_name: 'Svensson',
    email: 'anna@example.se',
    phone: '0701234567',
  },
  message: 'Jag vill gärna veta mer.',
  consent: { given: true, at: '2026-10-19T10:00:00Z' },
  source: { page: 'https://site.example/objekt/till-salu-vasastan-kungsgatan-1-P-1', utm: {} },
  record: { datatype: 'property', connection_id: CONNECTION, remote_id: 'P-1' },
});

/** What the window does: the form to the site's receiver, with the bot check's proof. */
const send = async (
  form: Record<string, unknown>,
  proof = HUMAN_TOKEN,
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const response = await fetch(`${siteUrl}/?rest_route=/core/v1/forms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-core-human': proof },
    body: JSON.stringify(form),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

type Kept = { id: string; kind: string; outcome: string; said: string };

/** The forms the site keeps, as its table holds them. */
const kept = async (): Promise<Kept[]> =>
  JSON.parse(
    (
      await wp(
        'eval',
        'global $wpdb; echo wp_json_encode($wpdb->get_results("SELECT id, kind, outcome, said FROM " . core_client_forms_table() . " ORDER BY sent_at, id"));',
      )
    ).stdout,
  ) as Kept[];

/** The page "Formulär" as an administrator sees it. */
const formsPage = async (): Promise<string> =>
  (await wp('eval', 'wp_set_current_user(1); core_client_forms_page();')).stdout;

beforeAll(async () => {
  crm.reset();
  core = await harness({
    adapters: [fakePollingAdapter],
    connections: [{ id: CONNECTION, provider: 'fake-polling' }],
    subscriber: false,
  });
  const site = await start({ url: core.baseUrl, token: TOKEN, bellSecret: BELL_SECRET });
  fillTheCrm();
  await poll();
  await site.trigger('delta');
  await wp('eval', 'global $wpdb; $wpdb->query("DELETE FROM " . core_client_forms_table());');
}, 120_000);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await stop();
  await core.stop();
});

describe('the WordPress client’s forms', () => {
  it('keeps every form it sends with the visitor’s details and the outcome on its page “Formulär”, and sends none again', async () => {
    const delivered = interest();
    expect((await send(delivered)).status).toBe(200);
    const failed = interest();
    crm.answerNext({ fail: 'connection refused' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await send(failed)).status).toBe(502);
    // A bot check that could not run in the visitor's browser: kept, so the form is not lost.
    const unchecked = interest();
    expect((await send(unchecked, 'unavailable:110200')).status).toBe(503);
    // A program without the bot check's proof is not a visitor: nothing is kept of it.
    expect((await send(interest(), 'a-bot')).status).toBe(403);

    const rows = await kept();
    expect(rows).toHaveLength(3);
    expect(rows).toEqual(
      expect.arrayContaining([
        { id: delivered['id'], kind: 'interest', outcome: 'delivered', said: '' },
        { id: failed['id'], kind: 'interest', outcome: 'crm', said: '' },
        expect.objectContaining({ id: unchecked['id'], outcome: 'check' }),
      ]),
    );
    const page = await formsPage();
    expect(page).toContain('<h1>Formulär</h1>');
    expect(page).toContain('Anna Svensson');
    expect(page).toContain('anna@example.se');
    expect(page).toContain('Jag vill gärna veta mer.');
    expect(page).toContain('>Kungsgatan 1</a>');
    expect(page).toContain('Kom fram till mäklaren.');
    expect(page).toContain('Kom inte fram: mäklarsystemet svarade inte.');
    expect(page).toContain('Kom inte fram: robotkontrollen fungerade inte.');
    // A form that did not reach the brokerage is not sent again: the visitor was told whom to contact.
    expect(page).not.toContain('Skicka igen');
    expect(page).toContain('Ett formulär som inte kom fram skickas inte igen');
    expect(crm.formsTaken()).toHaveLength(1);
  });

  it('tries a form that does not reach Core twice more under its id, so a restarting Core loses no form and none goes twice (166)', async () => {
    // A gateway in front of Core that answers its own error first, as one does while Core restarts.
    const asked: number[] = [];
    const gateway: Server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        asked.push(Date.now());
        if (asked.length === 1) {
          response.writeHead(502, { 'content-type': 'text/html' }).end('<html>Bad gateway</html>');
          return;
        }
        void fetch(`${core.baseUrl}${request.url ?? ''}`, {
          method: request.method ?? 'GET',
          headers: Object.fromEntries(
            Object.entries(request.headers).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === 'string' && !HOP_BY_HOP.has(entry[0]),
            ),
          ),
          ...(request.method === 'POST' ? { body: Buffer.concat(chunks) } : {}),
        }).then(async (answer) => {
          response
            .writeHead(answer.status, { 'content-type': 'application/json' })
            .end(await answer.text());
        });
      });
    });
    await new Promise<void>((resolve) => gateway.listen(0, '127.0.0.1', resolve));
    const before = await driver<{ value: string }>('option', 'core_client_url');
    await driver(
      'option',
      `core_client_url ${JSON.stringify(`http://127.0.0.1:${String((gateway.address() as AddressInfo).port)}`)}`,
    );
    try {
      const taken = crm.formsTaken().length;
      const answer = await send(interest());
      expect(answer.status).toBe(200);
      expect(asked).toHaveLength(2);
      expect(asked[1]! - asked[0]!).toBeGreaterThanOrEqual(1000);
      expect(crm.formsTaken()).toHaveLength(taken + 1);
    } finally {
      await driver('option', `core_client_url ${JSON.stringify(before.value)}`);
      await new Promise((resolve) => gateway.close(resolve));
    }
  });

  it('carries no WordPress security code on a public page, so a form sent from a copy of the page made a day earlier is taken (item 32)', async () => {
    const permalink = async (datatype: string, id: string): Promise<string> =>
      (
        await wp(
          'eval',
          `echo get_permalink(core_client_post_id(${JSON.stringify(datatype)}, ${JSON.stringify(id)}));`,
        )
      ).stdout.trim();
    const home = await permalink('property', 'P-1');
    const pages = [
      `${siteUrl}/`,
      `${siteUrl}/?post_type=core_property`,
      home,
      await permalink('agent', 'S-1'),
      await permalink('office', 'B-1'),
      await permalink('area', 'D-1'),
      await permalink('association', 'A-1'),
    ];
    for (const page of pages) {
      const response = await fetch(page);
      expect(response.status, page).toBe(200);
      // A security code expires within 24 hours, so a cached copy older than that would refuse.
      expect(await response.text(), page).not.toMatch(/nonce/i);
    }

    // The home's page as a page cache stored it, sent from once WordPress's codes made with it
    // have expired: the window's receiver and the home are read from the copy, as the script does.
    const copy = await (await fetch(home)).text();
    const endpoint = /<dialog class="t-form" data-endpoint="([^"]+)"/.exec(copy)?.[1];
    const named = /data-form="interest" data-record="property:([^":]+):([^"]+)"/.exec(copy);
    expect(endpoint).toBeDefined();
    expect(named?.[2]).toBe('P-1');
    await new Promise((resolve) => setTimeout(resolve, 2_100));
    const form = {
      ...interest(),
      record: { datatype: 'property', connection_id: named?.[1], remote_id: 'P-1' },
    };
    const answer = await fetch(endpoint!.replaceAll('&amp;', '&'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-core-human': HUMAN_TOKEN,
        // Every code WordPress made more than a second ago is expired for this request.
        'x-core-nonce-life': '1',
      },
      body: JSON.stringify(form),
    });
    expect(answer.status).toBe(200);
  });

  it('deletes a form with the visitor’s details once it is 30 days old, when the page “Formulär” opens', async () => {
    const [old, recent] = [randomUUID(), randomUUID()];
    await wp(
      'eval',
      `global $wpdb; foreach ([[${JSON.stringify(old)}, 31], [${JSON.stringify(recent)}, 29]] as [$id, $days]) { $at = gmdate('Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS); $wpdb->insert(core_client_forms_table(), ['id' => $id, 'sent_at' => $at, 'kind' => 'interest', 'body' => '{}', 'outcome' => 'delivered', 'said' => '']); }`,
    );
    expect((await kept()).map((form) => form.id)).toEqual(expect.arrayContaining([old, recent]));
    await formsPage();
    const ids = (await kept()).map((form) => form.id);
    expect(ids).toContain(recent);
    expect(ids).not.toContain(old);
  });

  it('drops the count of sends that “Skicka igen” kept, when a site updates from a plugin that had it', async () => {
    const columns = async (): Promise<string[]> =>
      JSON.parse(
        (
          await wp(
            'eval',
            'global $wpdb; echo wp_json_encode($wpdb->get_col("SHOW COLUMNS FROM " . core_client_forms_table()));',
          )
        ).stdout,
      ) as string[];
    await wp(
      'eval',
      'global $wpdb; $wpdb->query("ALTER TABLE " . core_client_forms_table() . " ADD COLUMN tries int NOT NULL DEFAULT 1, ADD COLUMN last_at datetime NULL");',
    );
    expect(await columns()).toEqual(expect.arrayContaining(['tries', 'last_at']));
    await wp('eval', 'core_client_install();');
    expect(await columns()).toEqual(['id', 'sent_at', 'kind', 'body', 'outcome', 'said']);
  });

  it('turned off on its page, the forms leave the pages and a form sent from a page kept from before is kept and refused; turned on, the window is back', async () => {
    const window = /<dialog class="t-form"/;
    expect(await (await fetch(`${siteUrl}/`)).text()).toMatch(window);
    await driver('option', 'core_client_forms_on "0"');
    try {
      const off = await (await fetch(`${siteUrl}/`)).text();
      expect(off).not.toMatch(window);
      expect(await formsPage()).toContain('name="forms_on" value="1" >');
      // A page cached while they were on gets a clear answer, and the form is kept.
      const late = interest();
      expect((await send(late)).status).toBe(503);
      expect((await kept()).find((form) => form.id === late['id'])).toMatchObject({
        outcome: 'off',
      });
    } finally {
      await driver('option', 'core_client_forms_on null');
    }
    expect(await (await fetch(`${siteUrl}/`)).text()).toMatch(window);
  });

  it('carries an interest, a viewing booking and a valuation through Core to the CRM and reads a viewing’s times, and no page or answer the site serves carries the site’s token or the CRM login', async () => {
    // The bookable viewing of Kungsgatan 3, with one free time, as the CRM has it now.
    crm.setShowings('P-3', [
      {
        showing_id: 'SH-1',
        from: soon(48),
        to: soon(49),
        book_before: soon(47),
        open_booking: true,
        shown: true,
        times: [{ time_id: 'T-1', from: soon(48), to: soon(48.5), open: true, places_left: 4 }],
      },
    ]);
    const served: string[] = [];
    const read = async (response: Response): Promise<string> => {
      const text = await response.text();
      served.push(text);
      return text;
    };
    const home = { datatype: 'property', connection_id: CONNECTION, remote_id: 'P-3' };

    // The times, read live through the site's receiver as a booking window reads them.
    const times = await fetch(
      `${siteUrl}/?${new URLSearchParams({ rest_route: '/core/v1/forms/slots', connection_id: CONNECTION, remote_id: 'P-3' }).toString()}`,
    );
    expect(times.status).toBe(200);
    expect(JSON.parse(await read(times))).toMatchObject({
      viewings: [{ id: 'SH-1', slots: [{ id: 'T-1' }] }],
    });

    // The three forms, each to the site's receiver with the bot check's proof, each delivered.
    const taken = crm.formsTaken().length;
    const forms: Record<string, unknown>[] = [
      { ...interest(), record: home },
      { ...interest(), kind: 'viewing', record: home, slot_id: 'T-1' },
      { ...interest(), kind: 'lead', record: undefined },
    ];
    for (const form of forms) {
      const response = await fetch(`${siteUrl}/?rest_route=/core/v1/forms`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-core-human': HUMAN_TOKEN },
        body: JSON.stringify(form),
      });
      expect(response.status, String(form.kind)).toBe(200);
      expect(JSON.parse(await read(response)), String(form.kind)).toMatchObject({
        status: 'delivered',
      });
    }
    const arrived = crm.formsTaken().slice(taken);
    expect(arrived).toHaveLength(3);
    expect(arrived[0]?.payload).toMatchObject({ object_id: 'P-3' });
    expect(arrived[1]?.payload).toMatchObject({ object_id: 'P-3', showing_time_id: 'T-1' });
    expect(arrived[2]?.payload).toMatchObject({ object_id: null });

    // The pages a visitor reads, the home's with its window among them: neither the site's token
    // nor Core's address is in any of them or in any answer above. The CRM login never reaches
    // the site at all: Core keeps it, and the site holds only its token.
    const permalink = async (datatype: string, id: string): Promise<string> =>
      (
        await wp(
          'eval',
          `echo get_permalink(core_client_post_id(${JSON.stringify(datatype)}, ${JSON.stringify(id)}));`,
        )
      ).stdout.trim();
    for (const address of [
      `${siteUrl}/`,
      `${siteUrl}/?post_type=core_property`,
      await permalink('property', 'P-3'),
      await permalink('agent', 'S-1'),
    ]) {
      expect((await fetch(address)).status, address).toBe(200);
      await read(await fetch(address));
    }
    expect(served.some((text) => text.includes('data-endpoint='))).toBe(true);
    for (const text of served) {
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain(core.baseUrl);
    }
  });
});
