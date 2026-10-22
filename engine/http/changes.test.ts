// A changes page of records the size of real ones (AC 27): it goes out as the database holds it,
// in parts compressed as they are sent, and reads back as the stored JSON; a site that hangs up
// halfway leaves Core answering the next one.
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { truncate } from '../../acceptance/harness.js';
import { startEngine, type Engine } from '../index.js';
import { createTenant, upsertConnection } from '../storage/connections.js';
import { closeDb, db } from '../storage/db.js';
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

/** Core with one tenant and `count` properties of that size. */
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

describe('a changes page', () => {
  it('sends records of a real size as the database holds them, compressed as they go', async () => {
    const baseUrl = await coreWith(PAGE_SIZE + 1);

    const response = await fetch(`${baseUrl}/v1/changes?datatype=property`, {
      headers: { authorization: `Bearer ${TOKEN}`, 'accept-encoding': 'gzip' },
    });
    const page = (await response.json()) as {
      items: { remote_id: string; raw: unknown; data: unknown }[];
      next_after: number;
      has_more: boolean;
    };

    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(response.headers.get('content-length')).toBeNull();
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
