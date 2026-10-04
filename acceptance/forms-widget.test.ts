// The browser's door to the forms (docs/forms.md, "The widget", question 137; AC 46 and 48): a
// site's widget reaches Core with the site's public key and the site's origin and nothing else,
// Core answers what the widget shows and sends what it posts through the same code as the
// server's door, and a key used from elsewhere, a switched-off site, a failed bot check or too
// many posts from one address are refused before any CRM call. Against the fake polling CRM.
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { harness, pull, until, type Harness } from './harness.js';
import { fakePollingAdapter, poll } from '../adapters/fake-polling/index.js';
import * as crm from '../adapters/fake-polling/crm.js';
import { subscribers, updateSubscriber } from '../engine/storage/connections.js';
import { configureHumanCheck } from '../engine/human.js';
import { SUBMISSIONS_PER_ADDRESS } from '../engine/http/forms.js';

const CONNECTION = 'polling-acme';
const HOME = 'P-1';
const OFFICE = 'B-1';
const ORIGIN = 'https://acme.example';

const home = {
  object_id: HOME,
  stage: 'active',
  object_type: 'flat',
  street: 'Kungsgatan 1',
  price: 7250000,
  rooms: 3,
  living_space: 78,
  lkf: '0180',
  branch_id: OFFICE,
  districts: ['D-1'],
  staff: [],
  coop_id: null,
  viewings: [{ starts_at: '2026-10-12T11:00:00.000Z', ends_at: '2026-10-12T11:30:00.000Z' }],
};

const person = {
  first_name: 'Anna',
  last_name: 'Svensson',
  email: 'anna@example.se',
  phone: '0701234567',
};

const submission = (
  kind: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: randomUUID(),
  kind,
  person,
  consent: { given: true, at: '2026-10-04T10:00:00Z' },
  source: { page: `${ORIGIN}/objekt/till-salu-stockholm-kungsgatan-1-P-1`, utm: {} },
  ...extra,
});

const record = { datatype: 'property', connection_id: CONNECTION, remote_id: HOME };

let running: Harness;
let siteKey = '';

type Reply = { status: number; headers: Headers; body: Record<string, unknown> };

const call = async (
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Reply> => {
  const headers: Record<string, string> = {
    'x-core-site-key': siteKey,
    origin: ORIGIN,
    'x-core-client': 'core-forms/test',
    ...init.headers,
  };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${running.baseUrl}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
};

const post = (body: unknown, headers: Record<string, string> = {}): Promise<Reply> =>
  call('/v1/forms/submissions', { method: 'POST', body, headers });

beforeAll(() => {
  // The widget as `npm run build` makes it; built here when a plain test run has not built it.
  if (!existsSync('dist/widget/forms.js')) {
    execFileSync('npx', ['vite', 'build', '--config', 'clients/forms-widget/vite.config.ts'], {
      stdio: 'ignore',
    });
  }
});

beforeEach(async () => {
  crm.reset();
  running = await harness({
    adapters: [fakePollingAdapter],
    connections: [{ id: CONNECTION, provider: 'fake-polling', licensedOffices: [OFFICE] }],
  });
  const site = (await subscribers())[0];
  if (!site) throw new Error('the harness made no site');
  siteKey = site.site_key;
  await updateSubscriber(Number(site.id), { origins: [ORIGIN] });
  crm.put('area', 'D-1', { district_id: 'D-1', district_name: 'Vasastan', lkf: '0180' });
  crm.put('area', 'D-2', { district_id: 'D-2', district_name: 'Östermalm', lkf: '0180' });
  crm.put('property', HOME, home);
  crm.setShowings(HOME, [
    {
      showing_id: 'SH-1',
      from: '2026-10-12T11:00:00.000Z',
      to: '2026-10-12T11:30:00.000Z',
      open_booking: true,
      shown: true,
      times: [
        {
          time_id: 'T-1',
          from: '2026-10-12T11:00:00.000Z',
          to: '2026-10-12T11:30:00.000Z',
          open: true,
          places_left: 4,
        },
      ],
    },
  ]);
  await poll();
  await until(
    async () => (await pull(running.baseUrl, 'property')).items.length === 1,
    'the home to be in Core',
  );
});

afterEach(async () => {
  configureHumanCheck(null);
  await running.stop();
});

describe('the forms widget’s door', () => {
  it('answers the config, the record and the slots to the site key from the site’s origin, and sends a submission through to the CRM', async () => {
    const config = await call('/v1/forms/config');
    expect(config.status).toBe(200);
    expect(config.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(config.body).toEqual({
      site: 'test site',
      kinds: ['lead', 'interest', 'viewing', 'search_profile'],
      areas: [
        { id: 'D-1', name: 'Vasastan', county_municipality_code: '0180' },
        { id: 'D-2', name: 'Östermalm', county_municipality_code: '0180' },
      ],
      human: null,
    });

    const found = await call(`/v1/forms/record?connection_id=${CONNECTION}&remote_id=${HOME}`);
    expect(found.status).toBe(200);
    expect(found.body).toEqual({
      title: 'Kungsgatan 1',
      rooms: 3,
      living_space: 78,
      areas: [{ id: 'D-1', name: 'Vasastan', county_municipality_code: '0180' }],
      county_municipality_code: '0180',
      viewings: [
        {
          id: 'viewing-1',
          starts_at: '2026-10-12T11:00:00.000Z',
          ends_at: '2026-10-12T11:30:00.000Z',
        },
      ],
    });

    const slots = await call(`/v1/forms/slots?connection_id=${CONNECTION}&remote_id=${HOME}`);
    expect(slots.status).toBe(200);
    expect((slots.body['viewings'] as unknown[]).length).toBe(1);

    const sent = await post(submission('viewing', { record, slot_id: 'T-1' }));
    expect(sent.status).toBe(200);
    expect(sent.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(sent.body['status']).toBe('delivered');
    expect(crm.formsTaken().map((form) => form.form)).toEqual(['SHOWING_BOOKING']);
    expect(crm.formsTaken()[0]?.payload['showing_time_id']).toBe('T-1');

    // The preflight: a browser on the site's address may ask, a stranger gets nothing.
    const allowed = await fetch(`${running.baseUrl}/v1/forms/submissions`, {
      method: 'OPTIONS',
      headers: { origin: ORIGIN, 'access-control-request-method': 'POST' },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(allowed.headers.get('access-control-allow-headers')).toContain('x-core-site-key');
    const stranger = await fetch(`${running.baseUrl}/v1/forms/submissions`, {
      method: 'OPTIONS',
      headers: { origin: 'https://elsewhere.example' },
    });
    expect(stranger.status).toBe(403);
    expect(stranger.headers.get('access-control-allow-origin')).toBeNull();

    // The widget itself, served by Core with a short cache.
    const widget = await fetch(`${running.baseUrl}/widget/forms.js`);
    expect(widget.status).toBe(200);
    expect(widget.headers.get('content-type')).toContain('text/javascript');
    expect(widget.headers.get('cache-control')).toBe('public, max-age=300');
    expect(await widget.text()).toContain('data-core-form');
  });

  it('refuses a missing or unknown site key, a foreign or missing origin, a switched-off site, a failed human check and the 11th submission in a minute from one address, before any CRM call', async () => {
    const noKey = await post(submission('interest', { record }), { 'x-core-site-key': '' });
    expect(noKey.status).toBe(401);
    const wrongKey = await post(submission('interest', { record }), {
      'x-core-site-key': 'pk_nope',
    });
    expect(wrongKey.status).toBe(401);
    const elsewhere = await post(submission('interest', { record }), {
      origin: 'https://elsewhere.example',
    });
    expect(elsewhere.status).toBe(403);
    expect(elsewhere.headers.get('access-control-allow-origin')).toBeNull();
    const noOrigin = await fetch(`${running.baseUrl}/v1/forms/config`, {
      headers: { 'x-core-site-key': siteKey },
    });
    expect(noOrigin.status).toBe(403);

    // The bot gate: with a service configured, no token or a bad token is refused, a good one passes.
    configureHumanCheck({
      provider: 'turnstile',
      siteKey: '1x00000000000000000000AA',
      verify: (token) => Promise.resolve(token === 'a-person'),
    });
    const config = await call('/v1/forms/config');
    expect(config.body['human']).toEqual({
      provider: 'turnstile',
      site_key: '1x00000000000000000000AA',
    });
    const noToken = await post(submission('interest', { record }));
    expect(noToken.status).toBe(403);
    const badToken = await post(submission('interest', { record }), { 'x-core-human': 'a-bot' });
    expect(badToken.status).toBe(403);
    expect(crm.formsTaken()).toEqual([]);
    const person_ = await post(submission('interest', { record }), { 'x-core-human': 'a-person' });
    expect(person_.status).toBe(200);
    expect(crm.formsTaken().map((form) => form.form)).toEqual(['INTEREST']);
    configureHumanCheck(null);

    // A switched-off site is refused, with the CORS header so the page can read the answer.
    const site = (await subscribers())[0];
    await updateSubscriber(Number(site?.id), { active: false });
    const off = await post(submission('interest', { record }));
    expect(off.status).toBe(403);
    expect(off.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    await updateSubscriber(Number(site?.id), { active: true });

    // The limit per address: the three posts the gate saw count, the rest fill the minute, the
    // next is 429 before any CRM call.
    const taken = crm.formsTaken().length;
    for (let sent = 3; sent < SUBMISSIONS_PER_ADDRESS; sent += 1) {
      expect((await post(submission('interest', { record }))).status).toBe(200);
    }
    const over = await post(submission('interest', { record }));
    expect(over.status).toBe(429);
    expect(crm.formsTaken().length).toBe(taken + SUBMISSIONS_PER_ADDRESS - 3);
  });
});
