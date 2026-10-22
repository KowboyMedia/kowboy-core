// A changes page of records the size of real ones (AC 27): it is put together from the records'
// parts, compressed already (question 227), and reads back as the stored JSON, whether a record
// has its part yet or not; a site that hangs up halfway leaves Core answering the next one.
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { truncate } from '../../acceptance/harness.js';
import { startEngine, type Engine } from '../index.js';
import { createTenant, upsertConnection } from '../storage/connections.js';
import { closeDb, db } from '../storage/db.js';
import { fillPageParts } from '../storage/items.js';
import { PAGE_SIZE } from './changes.js';

const TOKEN = 'changes-test-token';
/** A record about the size of a real home's payload, some 40 KB of JSON. */
const RECORD = Object.fromEntries(
  Array.from({ length: 400 }, (_, n) => [`field_${String(n)}`, `Value ${String(n)} `.repeat(8)]),
);

let engine: Engine | null = null;

afterEach(async () => {
  await engine?.stop();
  engine = null;
  await closeDb();
});

/** Core with one tenant and `count` properties of that size, stored as before parts were. */
async function coreWith(count: number): Promise<string> {
  engine = await startEngine({ port: 0 });
  await truncate();
  const tenantId = await createTenant({ displayName: 'Changes test', token: TOKEN });
  await upsertConnection({ id: 'changes-test', tenantId, provider: 'anycrm' });
  await db().query(
    `insert into items (tenant_id, connection_id, datatype, remote_id, seq, content_hash, raw, data, rules_version)
     select $1, 'changes-test', 'property', 'P' || n, nextval('item_seq'), md5(n::text), $2, $3, 'test'
     from generate_series(1, $4::int) as n`,
    [tenantId, JSON.stringify(RECORD), JSON.stringify({ heading: 'A home', ...RECORD }), count],
  );
  const server = engine.listen();
  return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
}

type Page = {
  items: { remote_id: string; seq: number; deleted: boolean; raw: unknown; data: unknown }[];
  next_after: number;
  has_more: boolean;
};

const pageOf = async (baseUrl: string, after = 0): Promise<{ page: Page; response: Response }> => {
  const response = await fetch(`${baseUrl}/v1/changes?datatype=property&after=${String(after)}`, {
    headers: { authorization: `Bearer ${TOKEN}`, 'accept-encoding': 'gzip' },
  });
  return { page: (await response.json()) as Page, response };
};

describe('a changes page', () => {
  it('sends records of a real size, the same before and after they have their parts', async () => {
    const baseUrl = await coreWith(PAGE_SIZE + 1);

    const before = await pageOf(baseUrl);
    expect(await fillPageParts()).toBe(PAGE_SIZE + 1);
    const { page, response } = await pageOf(baseUrl);

    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(page).toEqual(before.page);
    expect(page.items).toHaveLength(PAGE_SIZE);
    expect(page.has_more).toBe(true);
    expect(page.items[0]?.raw).toEqual(RECORD);
    expect(page.items[0]?.data).toEqual({ heading: 'A home', ...RECORD });
    const plain = await fetch(`${baseUrl}/v1/changes?datatype=property&after=${page.next_after}`, {
      headers: { authorization: `Bearer ${TOKEN}`, 'accept-encoding': 'identity' },
    });
    expect(plain.headers.get('content-encoding')).toBeNull();
    expect(((await plain.json()) as { items: unknown[] }).items).toHaveLength(1);
  });

  it('never sends a part a version of Core without parts left behind', async () => {
    const baseUrl = await coreWith(1);
    await fillPageParts();

    // As an older version writes: the record changes, its part is not touched.
    await db().query(
      `update items set data = $1, content_hash = 'changed', seq = nextval('item_seq')`,
      [JSON.stringify({ heading: 'Changed' })],
    );
    const { page } = await pageOf(baseUrl);

    expect(page.items[0]?.data).toEqual({ heading: 'Changed' });
    const { rows } = await db().query<{ page_part: Buffer | null }>('select page_part from items');
    expect(rows[0]?.page_part).toBeNull();
  });

  it('answers the next site when one hangs up halfway through a page', async () => {
    const baseUrl = await coreWith(PAGE_SIZE);
    const url = new URL('/v1/changes?datatype=property', baseUrl);

    await new Promise<void>((resolve) => {
      const call = request(url, {
        headers: { authorization: `Bearer ${TOKEN}`, 'accept-encoding': 'gzip' },
      });
      call.on('response', (response) => {
        response.once('data', () => {
          call.destroy();
          resolve();
        });
      });
      call.on('error', () => resolve());
      call.end();
    });
    const next = await fetch(url, {
      headers: { authorization: `Bearer ${TOKEN}`, 'accept-encoding': 'gzip' },
    });

    expect(next.status).toBe(200);
    expect(((await next.json()) as { items: unknown[] }).items).toHaveLength(PAGE_SIZE);
  });
});
