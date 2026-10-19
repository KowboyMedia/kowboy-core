// A website saved in the panel goes on the bot check's list first (171 a), on every save: a full
// list refuses the website and saves nothing; any other failure saves it and sends the check's own
// sentence back as a warning. The check is a stand-in here, so no test calls Cloudflare.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, TENANT, type Harness } from '../../acceptance/harness.js';
import { db } from '../storage/db.js';
import { tokenHmac } from '../storage/crypto.js';
import type { Listed } from '../human.js';
import { COOKIE } from './auth.js';

const listing = vi.hoisted(() => ({
  answer: { listed: true } as Listed,
  asked: [] as string[],
}));

vi.mock('../human.js', async (original) => ({
  ...(await original<typeof import('../human.js')>()),
  listOnBotCheck: (address: string) => {
    listing.asked.push(address);
    return Promise.resolve(listing.answer);
  },
}));

let core: Harness;
const SESSION = 'botcheck-test-session';

const FULL =
  'The bot check’s list at Cloudflare holds 10 websites, the most its free plan allows, so this website is not saved. An eleventh website needs Cloudflare’s paid plan first.';
const SILENT =
  'Cloudflare did not answer, so the website’s address could not be put on the bot check’s list; save the website again in a while.';

beforeAll(async () => {
  core = await harness({ adapters: [], connections: [] });
});
afterAll(async () => {
  await core.stop();
});
beforeEach(async () => {
  listing.answer = { listed: true };
  listing.asked = [];
  await db().query('truncate admin_sessions');
  await db().query(
    `delete from subscribers where tenant_id = $1
       and id <> (select min(id) from subscribers where tenant_id = $1)`,
    [TENANT],
  );
  await db().query(
    `insert into admin_sessions (token_hmac, email, expires_at) values ($1, 'tester@kowboy.se', now() + interval '1 day')`,
    [tokenHmac(SESSION, core.engine.config.credentialsKey)],
  );
});

async function call(
  path: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${core.baseUrl}/v1/panel${path}`, {
    method: 'POST',
    headers: { cookie: `${COOKIE}=${SESSION}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

const sites = async (): Promise<{ label: string; bell_url: string }[]> =>
  (
    await db().query<{ label: string; bell_url: string }>(
      'select label, bell_url from subscribers where tenant_id = $1 order by id',
      [TENANT],
    )
  ).rows;

describe('a website saved goes on the bot check’s list', () => {
  it('saves a website the list takes, and says nothing more', async () => {
    const added = await call(`/brokerages/${String(TENANT)}/websites`, {
      label: 'ahre.se',
      bellUrl: 'https://ahre.se/wp-json/core/v1/bell',
    });
    expect(added.status).toBe(201);
    expect(Object.keys(added.json)).toEqual(['id']);
    expect(listing.asked).toEqual(['https://ahre.se/wp-json/core/v1/bell']);
  });

  it('refuses a website when the list is full, and saves nothing', async () => {
    listing.answer = { listed: false, full: true, why: FULL };
    const before = await sites();
    const added = await call(`/brokerages/${String(TENANT)}/websites`, {
      label: 'eleventh.se',
      bellUrl: 'https://eleventh.se/bell',
    });
    expect(added).toEqual({ status: 409, json: { error: 'bot check', message: FULL } });
    expect(await sites()).toEqual(before);
  });

  it('saves a website the check could not list, with its sentence as a warning', async () => {
    listing.answer = { listed: false, full: false, why: SILENT };
    const added = await call(`/brokerages/${String(TENANT)}/websites`, {
      label: 'ahre.se',
      bellUrl: 'https://ahre.se/bell',
    });
    expect(added.status).toBe(201);
    expect(added.json['warning']).toBe(SILENT);
    expect((await sites()).map((site) => site.label)).toContain('ahre.se');
  });

  it('lists the address again on every edit, refusing or warning as on an add', async () => {
    const added = await call(`/brokerages/${String(TENANT)}/websites`, {
      label: 'ahre.se',
      bellUrl: 'https://ahre.se/bell',
    });
    const id = String(added.json['id']);

    // The same address saved again: the check is asked again, so a save retries it.
    listing.answer = { listed: false, full: false, why: SILENT };
    const warned = await call(`/websites/${id}/edit`, {
      label: 'ahre.se',
      bellUrl: 'https://ahre.se/bell',
    });
    expect(warned).toEqual({ status: 200, json: { ok: true, warning: SILENT } });
    expect(listing.asked).toEqual(['https://ahre.se/bell', 'https://ahre.se/bell']);

    listing.answer = { listed: false, full: true, why: FULL };
    const refused = await call(`/websites/${id}/edit`, {
      label: 'other.se',
      bellUrl: 'https://other.se/bell',
    });
    expect(refused).toEqual({ status: 409, json: { error: 'bot check', message: FULL } });
    expect((await sites()).find((site) => site.bell_url === 'https://other.se/bell')).toBe(
      undefined,
    );

    listing.answer = { listed: true };
    expect(
      await call(`/websites/${id}/edit`, { label: 'ahre.se', bellUrl: 'https://ahre.se/bell' }),
    ).toEqual({ status: 200, json: { ok: true } });
  });
});
