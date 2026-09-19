// A stand-in for Vitec Connect's advertising endpoints, in the shapes the documentation gives
// (docs/inputs/vitec/api/): basic authentication, paged id lists with a change-date filter, and
// records by id. Tests put records in, and read what was requested.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export const USERNAME = 'partner';
export const PASSWORD = 'connect-key';

type Record_ = Record<string, unknown> & { id: string; changedAt?: string };

const RESOURCES: Record<string, string> = {
  Estate: 'property',
  User: 'agent',
  Office: 'office',
  Area: 'area',
  Association: 'association',
  Project: 'project',
};

export type FakeConnect = {
  url: string;
  put(officeId: string, datatype: string, record: Record_): void;
  remove(officeId: string, datatype: string, id: string): void;
  /** Take a record off the list (no longer marketed) while it still answers by id. */
  unlist(officeId: string, datatype: string, id: string): void;
  /** Answer the next `times` requests with HTTP 500. */
  failNext(times: number): void;
  /** Answer 403 for this office from now on, as Connect does for a closed one. */
  forbid(officeId: string): void;
  allow(officeId: string): void;
  /** Answer the next `times` requests with 200 and a body that is not JSON. */
  brokenNext(times: number): void;
  /** Answer the next request with 503 and a Retry-After of this many seconds. */
  retryAfterNext(seconds: number): void;
  /** Hold every request this long, so concurrency can be observed. */
  delayMs: number;
  requests: { path: string; query: URLSearchParams }[];
  maxInFlight: number;
  close(): Promise<void>;
};

export function startFakeConnect(): Promise<FakeConnect> {
  const store = new Map<string, Map<string, Record_>>();
  const bucket = (officeId: string, datatype: string): Map<string, Record_> => {
    const key = `${officeId}/${datatype}`;
    const existing = store.get(key);
    if (existing) return existing;
    const created = new Map<string, Record_>();
    store.set(key, created);
    return created;
  };

  const expectedAuth = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}`;
  const unlisted = new Set<string>();
  const forbidden = new Set<string>();
  let failures = 0;
  let broken = 0;
  let retryAfter = 0;
  let inFlight = 0;
  const fake: FakeConnect = {
    url: '',
    put: (officeId, datatype, record) => {
      unlisted.delete(`${officeId}/${datatype}/${record.id}`);
      bucket(officeId, datatype).set(record.id, record);
    },
    remove: (officeId, datatype, id) => bucket(officeId, datatype).delete(id),
    unlist: (officeId, datatype, id) => unlisted.add(`${officeId}/${datatype}/${id}`),
    failNext: (times) => (failures = times),
    forbid: (officeId) => forbidden.add(officeId),
    allow: (officeId) => forbidden.delete(officeId),
    brokenNext: (times) => (broken = times),
    retryAfterNext: (seconds) => (retryAfter = seconds),
    delayMs: 0,
    requests: [],
    maxInFlight: 0,
    close: () => Promise.resolve(),
  };

  /** The trouble a test asked for, one request at a time: a 500, a Retry-After, a broken body. */
  const misbehave = (): {
    status: number;
    headers: Record<string, string>;
    body: string;
  } | null => {
    if (failures > 0) {
      failures -= 1;
      return { status: 500, headers: {}, body: '{"message":"broken"}' };
    }
    if (retryAfter > 0) {
      const seconds = retryAfter;
      retryAfter = 0;
      return {
        status: 503,
        headers: { 'retry-after': String(seconds) },
        body: '{"message":"busy"}',
      };
    }
    if (broken > 0) {
      broken -= 1;
      return { status: 200, headers: {}, body: '{"rows": [{"id": "OBJ1", "custo' };
    }
    return null;
  };

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://connect.local');
    fake.requests.push({ path: url.pathname, query: url.searchParams });
    inFlight += 1;
    fake.maxInFlight = Math.max(fake.maxInFlight, inFlight);
    const reply = (status: number, body: unknown): void => {
      inFlight -= 1;
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    setTimeout(() => {
      if (request.headers['authorization'] !== expectedAuth) return reply(401, { message: 'no' });
      const trouble = misbehave();
      if (trouble) {
        inFlight -= 1;
        response.writeHead(trouble.status, {
          'content-type': 'application/json',
          ...trouble.headers,
        });
        return response.end(trouble.body);
      }
      const [, advertising, resource, officeId, id] = url.pathname.split('/');
      const datatype = resource ? RESOURCES[resource] : undefined;
      if (advertising !== 'Advertising' || !datatype || !officeId) return reply(404, {});
      if (forbidden.has(officeId)) return reply(403, { message: 'forbidden' });
      const records = bucket(officeId, datatype);
      if (id) {
        const record = records.get(id);
        return record ? reply(200, record) : reply(404, { message: 'not found' });
      }
      const since = url.searchParams.get('criteria.changedAtMinValue');
      const pageSize = Number(url.searchParams.get('paging.pageSize') ?? 100);
      const pageIndex = Number(url.searchParams.get('paging.pageIndex') ?? 0);
      const rows = [...records.values()]
        .filter((record) => !unlisted.has(`${officeId}/${datatype}/${record.id}`))
        .filter((record) => !since || new Date(record.changedAt ?? 0) >= new Date(since))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((record) => ({
          id: record.id,
          customerId: officeId,
          changedAt: record.changedAt ?? null,
        }));
      const page = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
      reply(200, {
        index: pageIndex,
        count: Math.ceil(rows.length / pageSize),
        totalRowCount: rows.length,
        rows: page,
      });
    }, fake.delayMs);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      fake.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      fake.close = () => new Promise((done) => server.close(() => done()));
      resolve(fake);
    });
  });
}
