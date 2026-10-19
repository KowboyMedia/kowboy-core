// The plugin's forms (docs/forms.md, "Built 2026-10-19"): its receiver keeps every form it sends,
// delivered or not, with the visitor's details and the outcome, for 30 days on its page
// "Formulär", where "Skicka igen" sends a form that did not reach the brokerage once more; a form
// that does not reach Core is tried twice more (question 166); and the page's switch turns the
// forms off, which takes the window off the pages. Proved against the test Core and its fake CRM
// on the WordPress install of test/setup.sh.
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { harness, HUMAN_TOKEN, TOKEN, type Harness } from '../../acceptance/harness.js';
import { fakePollingAdapter, poll } from '../../adapters/fake-polling/index.js';
import * as crm from '../../adapters/fake-polling/crm.js';
import { BELL_SECRET, CONNECTION } from '../sync-scenarios.js';
import { fillTheCrm } from './test/records.js';
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

/** A visitor's interest in Kungsgatan 1, as the theme's window builds it. */
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

type Kept = { id: string; kind: string; outcome: string; said: string; tries: string };

/** The forms the site keeps, as its table holds them. */
const kept = async (): Promise<Kept[]> =>
  JSON.parse(
    (
      await wp(
        'eval',
        'global $wpdb; echo wp_json_encode($wpdb->get_results("SELECT id, kind, outcome, said, tries FROM " . core_client_forms_table() . " ORDER BY sent_at, id"));',
      )
    ).stdout,
  ) as Kept[];

/** The page "Formulär" as an administrator sees it. */
const formsPage = async (): Promise<string> =>
  (await wp('eval', 'wp_set_current_user(1); core_client_forms_page();')).stdout;

/** "Skicka igen" on one form, as its button does it. */
const again = async (id: string): Promise<string> =>
  (await wp('eval', `echo core_client_forms_again(${JSON.stringify(id)});`)).stdout.trim();

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
  it('keeps every form it sends with the visitor’s details and the outcome on its page “Formulär”, and “Skicka igen” sends one the CRM did not take once more', async () => {
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
        { id: delivered['id'], kind: 'interest', outcome: 'delivered', said: '', tries: '1' },
        { id: failed['id'], kind: 'interest', outcome: 'crm', said: '', tries: '1' },
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
    // "Skicka igen" with its sentence, beside the two forms that did not reach the CRM only.
    expect(page.match(/value="Skicka igen"/g)).toHaveLength(2);
    expect(page).toContain('Skickar det en gång till, med samma uppgifter.');

    expect(await again(failed['id'] as string)).toBe('delivered');
    expect(crm.formsTaken()).toHaveLength(2);
    expect((await kept()).find((form) => form.id === failed['id'])).toMatchObject({
      outcome: 'delivered',
      tries: '2',
    });
    // The site's own send needs no proof, so the form the bot check stopped reaches the CRM too.
    expect(await again(unchecked['id'] as string)).toBe('delivered');
    expect(crm.formsTaken()).toHaveLength(3);
    // Pressed again, a form the CRM took is not sent twice.
    expect(await again(failed['id'] as string)).toBe('delivered');
    expect(crm.formsTaken()).toHaveLength(3);
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

  it('turned off on its page, the forms leave the pages and the buttons lead to a contact; turned on, the window is back', async () => {
    const window = /<dialog class="k-form"/;
    expect(await (await fetch(`${siteUrl}/`)).text()).toMatch(window);
    await driver('option', 'core_client_forms_on "0"');
    try {
      const off = await (await fetch(`${siteUrl}/`)).text();
      expect(off).not.toMatch(window);
      expect(off).toContain('href="#k-contact" data-k-form="lead"');
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
});
