// GET /v1/changes: the cursor, page size, authentication and compression.
import { request as httpRequest } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, pull, TOKEN, type Harness } from './harness.js';
import { fakeWebhookAdapter, drainFetchList } from '../adapters/fake-webhook/index.js';
import * as crm from '../adapters/fake-webhook/crm.js';
import { PAGE_SIZE } from '../engine/http/changes.js';

const CONNECTION = 'fake-acme';

const property = (ref: string): Record<string, unknown> => ({
  ref,
  state: 'FOR_SALE',
  streetAddress: `Storgatan ${ref}`,
  askingPrice: 4950000,
  officeRef: '100',
  areaRefs: ['area-77'],
  brokerRefs: ['AG-12'],
  associationRef: 'BRF-311',
  updatedUtc: '2026-09-08T10:02:00Z',
  internalCode: 1,
});

/** A raw request, so the response bytes are counted as the wire sees them. */
function raw(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  bytes: number;
}> {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers },
      (response) => {
        let bytes = 0;
        response.on('data', (chunk: Buffer) => (bytes += chunk.length));
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, headers: response.headers, bytes }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

let running: Harness;

beforeEach(async () => {
  crm.reset();
  running = await harness({
    adapters: [fakeWebhookAdapter],
    connections: [{ id: CONNECTION, provider: 'fake-webhook' }],
  });
});

afterEach(async () => {
  await running.stop();
});

const seed = async (count: number): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    const ref = `OBJ-${String(index).padStart(4, '0')}`;
    crm.put('property', ref, property(ref));
    await fetch(`${running.baseUrl}/v1/hook/fake-webhook/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ connection_id: CONNECTION, datatype: 'property', remote_id: ref }),
    });
  }
  await drainFetchList();
};

describe('GET /v1/changes', () => {
  it('returns everything from seq 0 and only newer items after that (AC 4)', async () => {
    await seed(3);
    const all = await pull(running.baseUrl, 'property');
    expect(all.items).toHaveLength(3);

    const firstSeq = Number(all.items[0]?.['seq']);
    const rest = await pull(running.baseUrl, 'property', firstSeq);
    expect(rest.items).toHaveLength(2);
    expect(rest.items.every((item) => Number(item['seq']) > firstSeq)).toBe(true);
    expect(all.next_after).toBe(Number(all.items[2]?.['seq']));
  });

  it('caps a page at the page size and says there is more', async () => {
    await seed(PAGE_SIZE + 5);
    const page = await raw(running.baseUrl, `/v1/changes?datatype=property&limit=1000`, {
      authorization: `Bearer ${TOKEN}`,
    });
    expect(page.status).toBe(200);

    const first = await pull(running.baseUrl, 'property');
    expect(first.items).toHaveLength(PAGE_SIZE);
    expect(first.has_more).toBe(true);

    const second = await pull(running.baseUrl, 'property', first.next_after);
    expect(second.items).toHaveLength(5);
    expect(second.has_more).toBe(false);
  });

  it('gzips a full page and stays readable without gzip (AC 40)', async () => {
    await seed(PAGE_SIZE);
    const compressed = await raw(running.baseUrl, '/v1/changes?datatype=property', {
      authorization: `Bearer ${TOKEN}`,
      'accept-encoding': 'gzip',
    });
    const plain = await raw(running.baseUrl, '/v1/changes?datatype=property', {
      authorization: `Bearer ${TOKEN}`,
      'accept-encoding': 'identity',
    });

    expect(compressed.headers['content-encoding']).toBe('gzip');
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.bytes / compressed.bytes).toBeGreaterThanOrEqual(4);

    const page = await pull(running.baseUrl, 'property');
    expect(page.items).toHaveLength(PAGE_SIZE);
  });

  it('refuses an unknown token, a missing token and a tenant_id parameter', async () => {
    const noToken = await fetch(`${running.baseUrl}/v1/changes?datatype=property`);
    expect(noToken.status).toBe(401);

    const badToken = await fetch(`${running.baseUrl}/v1/changes?datatype=property`, {
      headers: { authorization: 'Bearer nope' },
    });
    expect(badToken.status).toBe(401);

    const withTenant = await fetch(`${running.baseUrl}/v1/changes?datatype=property&tenant_id=2`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(withTenant.status).toBe(400);
  });

  it('rejects an unknown datatype', async () => {
    const response = await fetch(`${running.baseUrl}/v1/changes?datatype=banana`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.status).toBe(400);
  });
});
