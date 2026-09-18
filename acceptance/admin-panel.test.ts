// The admin panel (docs/admin-panel.md, AC 42) driven through HTTP against the real engine and
// the fake polling adapter: the login by email link, every Core panel, and the seam (an adapter's panel is
// mounted, the engine never looks inside it).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminLogin, harness, ADMIN_EMAIL, TENANT, type Harness } from './harness.js';
import { fakePollingAdapter, poll } from '../adapters/fake-polling/index.js';
import * as crm from '../adapters/fake-polling/crm.js';

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

  it('adds a tenant, shows its token once, and the token pulls changes (AC 42)', async () => {
    const page = await post('/admin/tenants', { id: 'acme', name: 'Acme Mäkleri' });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('Token for acme');
    const token = shownAfter(html, 'Token for acme');
    expect(token.length).toBeGreaterThan(20);
    const pull = await fetch(`${running.baseUrl}/v1/changes?datatype=property`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(pull.status).toBe(200);
    // A second token retires the first.
    const rotated = await post('/admin/tenants/acme/token', {});
    const next = shownAfter(await rotated.text(), 'Token for acme');
    expect(next).not.toBe(token);
    const old = await fetch(`${running.baseUrl}/v1/changes?datatype=property`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(old.status).toBe(401);
  });

  it('adds a site with a bell secret shown once, and rings it', async () => {
    const page = await post('/admin/sites', {
      tenant: TENANT,
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
    const rang = await post(`/admin/sites/${id}/ring`, { tenant: TENANT, kind: 'delta' });
    expect(rang.status).toBe(303);
  });

  it('creates a connection, saves it, and queues a lifecycle event the worker delivers', async () => {
    const created = await post('/admin/connections', {
      id: 'acme-fake',
      tenant: TENANT,
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
    const list = await (await get('/admin/connections')).text();
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
      tenant: TENANT,
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

  it('runs housekeeping from the settings page', async () => {
    const done = await post('/admin/settings/housekeeping', {});
    expect(done.status).toBe(303);
    expect(decodeURIComponent(done.headers.get('location') ?? '')).toContain('Housekeeping done');
    const settings = await (await get('/admin/settings')).text();
    expect(settings).toContain('Page size');
  });
});
