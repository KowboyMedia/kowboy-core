// The bot check's list at Cloudflare (question 171 a): saving a website in Core's admin puts its
// address on the list, an eleventh is refused on the free plan, and every other reason an address
// is not on it is said, never silent. Cloudflare is a stand-in here that keeps one setup.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configureBotCheckList,
  configureHumanCheck,
  LIST_LIMIT,
  listOnBotCheck,
  TEST_SECRET,
  TEST_SITE_KEY,
  turnstile,
} from './human.js';

const SITE_KEY = '0x4AAAAAAAkowboy';
const SECRET = '0x4AAAAAAAkowboy-secret';

/** Cloudflare's Turnstile setup as its API keeps it, with every call Core made to it. */
function cloudflare(domains: string[], secret = SECRET) {
  const setup = {
    name: 'Kowboy forms',
    mode: 'managed',
    clearance_level: 'no_clearance',
    domains,
    secret,
  };
  const calls: { method: string; url: string; body: unknown; auth: string | null }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as typeof setup) : null;
    calls.push({
      method: init?.method ?? 'GET',
      url: String(input),
      body,
      auth: new Headers(init?.headers).get('authorization'),
    });
    if (body) setup.domains = body.domains;
    return Promise.resolve(
      new Response(JSON.stringify({ success: true, result: { ...setup, sitekey: SITE_KEY } })),
    );
  });
  return { calls, setup };
}

afterEach(() => {
  vi.restoreAllMocks();
  configureHumanCheck(null);
  configureBotCheckList(null);
});

describe('the bot check’s list at Cloudflare', () => {
  it('puts a website’s address on the list once, keeping the setup as it was', async () => {
    configureHumanCheck(turnstile(SITE_KEY, SECRET));
    configureBotCheckList({ accountId: 'acc-1', token: 'cf-token' });
    const { calls, setup } = cloudflare(['norbanmakleri.se']);

    expect(await listOnBotCheck('https://www.ahre.se/wp-json/core/v1/bell')).toEqual({
      listed: true,
    });
    expect(setup.domains).toEqual(['norbanmakleri.se', 'www.ahre.se']);
    expect(calls.map((call) => call.method)).toEqual(['GET', 'PUT']);
    expect(calls[0]).toMatchObject({
      url: `https://api.cloudflare.com/client/v4/accounts/acc-1/challenges/widgets/${SITE_KEY}`,
      auth: 'Bearer cf-token',
    });
    expect(calls[1]?.body).toEqual({
      name: 'Kowboy forms',
      mode: 'managed',
      clearance_level: 'no_clearance',
      domains: ['norbanmakleri.se', 'www.ahre.se'],
    });

    // Saved again: already listed, nothing changed.
    expect(await listOnBotCheck('https://WWW.AHRE.SE/?rest_route=/core/v1/bell')).toEqual({
      listed: true,
    });
    expect(calls.map((call) => call.method)).toEqual(['GET', 'PUT', 'GET']);
  });

  it('refuses an eleventh website on the free plan, saying why', async () => {
    configureHumanCheck(turnstile(SITE_KEY, SECRET));
    configureBotCheckList({ accountId: 'acc-1', token: 'cf-token' });
    const ten = Array.from({ length: LIST_LIMIT }, (_, n) => `site${String(n)}.se`);
    const { calls } = cloudflare(ten);
    const answer = await listOnBotCheck('https://eleventh.se');
    expect(answer).toMatchObject({ listed: false, full: true });
    expect(answer).toHaveProperty('why', expect.stringContaining('holds 10 websites'));
    expect(calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('says why an address is not on the list: no Cloudflare key, no answer, another secret, no keys at all', async () => {
    configureHumanCheck(turnstile(SITE_KEY, SECRET));
    expect(await listOnBotCheck('https://ahre.se')).toMatchObject({
      listed: false,
      full: false,
      why: expect.stringContaining('Core has no Cloudflare key') as string,
    });

    configureBotCheckList({ accountId: 'acc-1', token: 'cf-token' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await listOnBotCheck('https://ahre.se')).toMatchObject({
      listed: false,
      why: expect.stringContaining('Cloudflare did not answer') as string,
    });
    vi.restoreAllMocks();

    // Core's secret is not the setup's: every visitor's proof would be refused.
    cloudflare(['ahre.se'], 'another-secret');
    expect(await listOnBotCheck('https://ahre.se')).toMatchObject({
      listed: false,
      why: expect.stringContaining('another secret') as string,
    });

    configureHumanCheck(null);
    expect(await listOnBotCheck('https://ahre.se')).toMatchObject({
      listed: false,
      why: expect.stringContaining('Core has no keys') as string,
    });
  });

  it('lists nothing with Cloudflare’s test keys, which take every address', async () => {
    configureHumanCheck(turnstile(TEST_SITE_KEY, TEST_SECRET));
    const fetched = vi.spyOn(globalThis, 'fetch');
    expect(await listOnBotCheck('https://ahre.se')).toEqual({ listed: true });
    expect(fetched).not.toHaveBeenCalled();
  });
});
