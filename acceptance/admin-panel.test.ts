// The admin panel (docs/admin-panel.md, AC 42) driven through HTTP against the real engine and
// the fake polling adapter: the login by email link, every Core panel, and the seam (an adapter's panel is
// mounted, the engine never looks inside it).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminLogin, harness, pull, ADMIN_EMAIL, TENANT, TOKEN, type Harness } from './harness.js';
import { fakePollingAdapter, poll } from '../adapters/fake-polling/index.js';
import * as crm from '../adapters/fake-polling/crm.js';
import { vitecAdapter } from '../adapters/vitec/index.js';
import { nav } from '../engine/admin/context.js';

const CONNECTION = 'polling-acme';
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

let running: Harness;
let cookie = '';
let csrf = '';

const get = (path: string, headers: Record<string, string> = {}): Promise<Response> =>
  fetch(`${running.baseUrl}${path}`, { headers: { cookie, ...headers }, redirect: 'manual' });

const post = (path: string, fields: Record<string, string>, withCsrf = true): Promise<Response> =>
  fetch(`${running.baseUrl}${path}`, {
    method: 'POST',
    headers: { cookie, ...FORM },
    body: new URLSearchParams(withCsrf ? { csrf, ...fields } : fields).toString(),
    redirect: 'manual',
  });

async function login(email = ADMIN_EMAIL, remember = false): Promise<Response> {
  const session = await adminLogin(running, email, remember);
  cookie = session.cookie;
  csrf = session.csrf;
  return session.response;
}

const linkIn = (text: string | undefined): string => text?.match(/https?:\/\/\S+/)?.[0] ?? '';

/** The value inside the first <pre> after a marker, as the page shows a secret once. */
const shownAfter = (html: string, marker: string): string => {
  const at = html.indexOf(marker);
  const start = html.indexOf('<pre>', at) + 5;
  return html.slice(start, html.indexOf('</pre>', start)).trim();
};

beforeEach(async () => {
  crm.reset();
  running = await harness({
    adapters: [fakePollingAdapter],
    connections: [{ id: CONNECTION, provider: 'fake-polling' }],
  });
  await login();
});

afterEach(async () => {
  await running.stop();
});

describe('the admin panel', () => {
  it('mails a login link to an allowed address only, answers every address the same, and refuses a form without its token', async () => {
    cookie = '';
    expect((await get('/admin')).status).toBe(303);
    expect((await get('/admin')).headers.get('location')).toBe('/admin/login');
    expect(await (await get('/admin/login')).text()).toContain('Send me a link');

    // An address at another domain: the same answer, no mail, and no word about the rule.
    const sent = running.mails.length;
    const refused = await post('/admin/login', { email: 'someone@elsewhere.test' }, false);
    expect(refused.status).toBe(200);
    const answer = await refused.text();
    expect(answer).toContain('If that address may log in, a link is on its way');
    expect(answer).not.toContain('example.test');
    expect(running.mails.length).toBe(sent);

    // An allowed address: the same answer, and a mail with the link.
    const allowed = await post('/admin/login', { email: 'Second@Example.test' }, false);
    expect(await allowed.text()).toBe(answer);
    const mail = running.mails.at(-1);
    expect(mail?.to).toBe('second@example.test');
    const link = linkIn(mail?.text);
    expect(link).toContain(`${running.baseUrl}/admin/login/`);

    // Asking again within a minute mails nothing.
    await post('/admin/login', { email: 'second@example.test' }, false);
    expect(running.mails.length).toBe(sent + 1);

    // A tampered link is refused; the real one logs in, and the shell shows who.
    const tampered = await fetch(`${link.slice(0, -1)}${link.endsWith('0') ? '1' : '0'}`, {
      redirect: 'manual',
    });
    expect(tampered.status).toBe(401);
    const opened = await fetch(link, { redirect: 'manual' });
    expect(opened.status).toBe(303);
    expect(opened.headers.get('location')).toBe('/admin');
    cookie = (opened.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const overview = await get('/admin');
    expect(overview.status).toBe(200);
    expect(await overview.text()).toContain('second@example.test');
    expect((await post('/admin/tenants', { id: 'x', name: 'X' }, false)).status).toBe(403);
  });

  it('mails at most ten links a day, whatever the form is fed', async () => {
    // The login before the test was the first of the day.
    for (let i = 0; i < 11; i += 1) {
      await post('/admin/login', { email: `cap-${i}@example.test` }, false);
    }
    expect(running.mails.length).toBe(10);
    expect(running.mails.at(-1)?.to).toBe('cap-8@example.test');
  });

  it('remembers the device for 30 days when asked, and for the browser session otherwise', async () => {
    const short = await login('short@example.test');
    expect(short.headers.get('set-cookie')).toContain('HttpOnly');
    expect(short.headers.get('set-cookie')).not.toContain('Max-Age');
    const long = await login('long@example.test', true);
    expect(long.headers.get('set-cookie')).toContain('Max-Age=2592000');
    expect((await get('/admin')).status).toBe(200);
    const out = await post('/admin/logout', {}, false);
    expect(out.status).toBe(303);
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('shows the overview with every health check, the adapter ones included', async () => {
    const html = await (await get('/admin')).text();
    expect(html).toContain('Health');
    expect(html).toContain('fake-polling.poll');
    expect(html).toContain('migrations applied');
  });

  it('adds a tenant, shows its token on the page at all times, and the token pulls changes (AC 42)', async () => {
    const tokenOf = (h: string): string => /class="user-select-all">([^<]+)</.exec(h)?.[1] ?? '';
    const created = await post('/admin/tenants', { name: 'Acme Mäkleri' });
    expect(created.status).toBe(200);
    const html = await created.text();
    const acme = /\/admin\/tenants\/(\d+)\/token/.exec(html)?.[1] ?? '';
    expect(acme).not.toBe('');
    const token = tokenOf(html);
    expect(token.length).toBeGreaterThan(20);
    // Shown again on a fresh open of the tenant page, not only the once (Patric, 2026-09-19).
    const reopened = await (await get(`/admin/tenants/${acme}`)).text();
    expect(tokenOf(reopened)).toBe(token);
    const pull = await fetch(`${running.baseUrl}/v1/changes?datatype=property`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(pull.status).toBe(200);
    // A second token retires the first, and is the one shown from then on.
    const rotated = await post(`/admin/tenants/${acme}/token`, {});
    const next = tokenOf(await rotated.text());
    expect(next).not.toBe(token);
    expect(tokenOf(await (await get(`/admin/tenants/${acme}`)).text())).toBe(next);
    const old = await fetch(`${running.baseUrl}/v1/changes?datatype=property`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(old.status).toBe(401);
  });

  it('adds a site with a bell secret shown once, and rings it', async () => {
    const page = await post('/admin/sites', {
      tenant: String(TENANT),
      label: 'acme.se',
      url: 'http://127.0.0.1:9/bell',
    });
    const html = await page.text();
    expect(html).toContain('Bell secret for site');
    expect(shownAfter(html, 'Bell secret for site').length).toBeGreaterThan(20);
    const listed = await (await get(`/admin/tenants/${TENANT}`)).text();
    expect(listed).toContain('acme.se');
    const overview = await (await get('/admin/tenants')).text();
    expect(overview).toContain(`/admin/tenants/${TENANT}`);
    const id = /\/admin\/sites\/(\d+)\/ring/.exec(listed)?.[1] ?? '';
    const rang = await post(`/admin/sites/${id}/ring`, { tenant: String(TENANT), kind: 'delta' });
    expect(rang.status).toBe(303);
  });

  it('creates a connection, saves it, and queues a lifecycle event the worker delivers', async () => {
    const created = await post('/admin/connections', {
      id: 'acme-fake',
      tenant: String(TENANT),
      provider: 'fake-polling',
      offices: 'B-1, B-2',
    });
    expect(created.status).toBe(303);
    expect(created.headers.get('location')).toContain('/admin/connections/acme-fake');
    const detail = await (await get('/admin/connections/acme-fake')).text();
    expect(detail).toContain('acme-fake');
    expect(detail).toContain('Load everything');

    const saved = await post('/admin/connections/acme-fake', { offices: 'B-1', active: 'yes' });
    expect(saved.status).toBe(303);
    const list = await (await get(`/admin/tenants/${TENANT}`)).text();
    expect(list).toContain('B-1');
    expect(list).not.toContain('B-2');

    const queued = await post('/admin/connections/acme-fake/event', { event: 'connection_added' });
    expect(queued.status).toBe(303);
    await running.deliver();
    const events = await (await get('/admin/events?connection=acme-fake')).text();
    expect(events).toContain('lifecycle.connection_added');
  });

  it('finds an item, shows raw, unified and display with its timeline, and recomputes it', async () => {
    crm.put('property', 'P-1', {
      object_id: 'P-1',
      stage: 'active',
      object_type: 'flat',
      street: 'Kungsgatan 1',
      price: 100,
      branch_id: 'B-1',
      districts: [],
      staff: [],
      coop_id: null,
    });
    await poll();
    const found = await (await get('/admin/items?datatype=property&id=P-1')).text();
    expect(found).toContain(`/admin/items/${CONNECTION}/property/P-1`);
    const item = await (await get(`/admin/items/${CONNECTION}/property/P-1`)).text();
    expect(item).toContain('Raw');
    expect(item).toContain('Kungsgatan 1');
    expect(item).toContain('entity.written');
    const recomputed = await post(`/admin/items/${CONNECTION}/property/P-1/recompute`, {});
    expect(await recomputed.text()).toContain('examined&quot;: 1');
  });

  it('pulls as a site from the test panel and shows the sizes', async () => {
    crm.put('property', 'P-2', {
      object_id: 'P-2',
      stage: 'active',
      branch_id: 'B-1',
      street: 'Nygatan 2',
    });
    await poll();
    const result = await post('/admin/test/changes', {
      tenant: String(TENANT),
      datatype: 'property',
      after: '0',
      limit: '10',
    });
    const html = await result.text();
    expect(html).toContain('bytes plain');
    expect(html).toContain('P-2');
    const events = await (await get('/admin/events?type=admin.test')).text();
    expect(events).toContain('admin.test');
  });

  it('keeps the events page up when a filter value is not a date or a number, and says so', async () => {
    const page = await get('/admin/events?from=notadate&to=yesterday&limit=abc');
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).not.toContain('Something went wrong');
    expect(html).toContain('From &quot;notadate&quot; is not a date');
    expect(html).toContain('To &quot;yesterday&quot; is not a date');
    // The filters that could not be used are left out; the rest of the page works.
    expect(html).toContain('admin.login');
    expect((await get('/admin/events?limit=-5')).status).toBe(200);
  });

  it('shows the dashboard: figures, two hourly charts with table twins, and no email mask', async () => {
    const html = await (await get('/admin')).text();
    expect(html).toContain('Dashboard');
    expect((html.match(/class="subheader"/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect((html.match(/viewBox="0 0 720 220"/g) ?? []).length).toBe(2);
    expect(html).toContain('As a table');
    expect(html).toContain('Records per datatype');
    // The platform's edge rewrites email addresses unless the page says not to.
    expect(html).toContain('<!--email_off-->');
  });

  it('filters items by tenant, entity type, office, date range and removal, and recomputes a selection', async () => {
    crm.put('property', 'P-3', {
      object_id: 'P-3',
      stage: 'active',
      branch_id: 'B-1',
      street: 'S 3',
    });
    crm.put('property', 'P-4', {
      object_id: 'P-4',
      stage: 'active',
      branch_id: 'B-2',
      street: 'S 4',
    });
    await poll();
    // The panel's days are Swedish days, so the test asks for today in Stockholm.
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(
      new Date(),
    );
    const rows = async (query: string): Promise<number> =>
      (await (await get(`/admin/items?${query}`)).text()).match(/name="key"/g)?.length ?? 0;
    expect(await rows(`datatype=&tenant=${TENANT}`)).toBe(2);
    expect(await rows('datatype=property&office=B-2')).toBe(1);
    expect(await rows(`datatype=&from=${today}&to=${today}`)).toBe(2);
    expect(await rows('datatype=&from=2000-01-01&to=2000-01-02')).toBe(0);
    expect(await rows('datatype=&removed=yes')).toBe(0);
    expect(await rows('datatype=&tenant=999')).toBe(0);

    const ticked = new URLSearchParams([
      ['csrf', csrf],
      ['back', '/admin/items?datatype='],
      ['key', `${CONNECTION}/property/P-3`],
      ['key', `${CONNECTION}/property/P-4`],
    ]);
    const recomputed = await fetch(`${running.baseUrl}/admin/items/recompute`, {
      method: 'POST',
      headers: { cookie, ...FORM },
      body: ticked.toString(),
    });
    const result = await recomputed.text();
    expect(result).toContain('examined&quot;: 2');
    expect(result).toContain('failed&quot;: 0');
    const none = await post('/admin/items/recompute', { back: '/admin/items' });
    expect(none.status).toBe(303);
    expect(decodeURIComponent(none.headers.get('location') ?? '')).toContain('Tick at least one');
  });

  it('lists the live activity of the write path, a state per row, and turns a row to applied when a site reports it', async () => {
    crm.put('property', 'P-5', {
      object_id: 'P-5',
      stage: 'active',
      branch_id: 'B-1',
      street: 'S 5',
    });
    await poll();
    const page = await (await get('/admin/items')).text();
    expect(page).toContain('id="activity"');
    expect(page).toContain('data-state="fetched"');
    const seq = (await pull(running.baseUrl, 'property')).items[0]?.['seq'];
    const applied = await fetch(`${running.baseUrl}/v1/applied`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
        'x-core-client': 'wp/1.0',
      },
      body: JSON.stringify({
        items: [
          {
            datatype: 'property',
            connection_id: CONNECTION,
            remote_id: 'P-5',
            seq,
            result: 'applied',
          },
        ],
      }),
    });
    expect(applied.status).toBe(202);
    const rows = await (await get('/admin/items/activity')).text();
    expect(rows).toContain(`/admin/items/${CONNECTION}/property/P-5`);
    expect(rows).toMatch(/table-success[^>]*data-state="applied"/);
    expect(rows).toContain('wp/1.0 applied');
  });

  it('names only pages the panel has in every adapter’s setup directions', async () => {
    const pages = new Set(nav([]).map((item) => item.label));
    for (const adapter of [fakePollingAdapter, vitecAdapter]) {
      const front = adapter.admin?.panels[0];
      if (!front) continue;
      const result = await front.handle({
        method: 'GET',
        url: `/admin/${adapter.manifest.provider}`,
        headers: {},
        body: Buffer.alloc(0),
        form: {},
        csrf: '',
        connections: async () => [],
      });
      const text = 'html' in result ? result.html.replace(/<[^>]+>/g, ' ') : '';
      const named = [...text.matchAll(/\bOn ([A-Z][a-z]+)\b/g)].map((m) => m[1] ?? '');
      expect(named.length).toBeGreaterThan(0);
      for (const page of named)
        expect(pages, `${adapter.manifest.provider} names ${page}`).toContain(page);
    }
  });

  it('runs housekeeping from the settings page', async () => {
    const done = await post('/admin/settings/housekeeping', {});
    expect(done.status).toBe(303);
    expect(decodeURIComponent(done.headers.get('location') ?? '')).toContain('Housekeeping done');
    const settings = await (await get('/admin/settings')).text();
    expect(settings).toContain('Page size');
  });
});
