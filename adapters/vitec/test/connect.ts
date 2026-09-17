// A stand-in for Vitec Connect's advertising endpoints, in the shapes the documentation gives
// (docs/inputs/vitec/api/) and Connect was seen to use (2026-09-17): basic authentication, paged
// id lists from page 0 with a change-date filter, `count` as the number of pages, an empty page
// past the end, and records by id. Tests put records in, and read what was requested.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export const USERNAME = 'partner';
export const PASSWORD = 'connect-key';

const SWEDISH = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
});

/** A moment as Connect writes every date: Swedish wall-clock time, no offset. */
export function stockholm(at: Date): string {
  const parts = SWEDISH.formatToParts(at);
  const of = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${of('year')}-${of('month')}-${of('day')}T${of('hour')}:${of('minute')}:${of('second')}.${of('fractionalSecond')}`;
}

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
  /** Answer the next `times` requests with HTTP 500. */
  failNext(times: number): void;
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
  let failures = 0;
  let inFlight = 0;
  const fake: FakeConnect = {
    url: '',
    put: (officeId, datatype, record) => bucket(officeId, datatype).set(record.id, record),
    remove: (officeId, datatype, id) => bucket(officeId, datatype).delete(id),
    failNext: (times) => (failures = times),
    delayMs: 0,
    requests: [],
    maxInFlight: 0,
    close: () => Promise.resolve(),
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
      if (failures > 0) {
        failures -= 1;
        return reply(500, { message: 'broken' });
      }
      const [, advertising, resource, officeId, id] = url.pathname.split('/');
      const datatype = resource ? RESOURCES[resource] : undefined;
      if (advertising !== 'Advertising' || !datatype || !officeId) return reply(404, {});
      const records = bucket(officeId, datatype);
      if (id) {
        const record = records.get(id);
        return record ? reply(200, record) : reply(404, { message: 'not found' });
      }
      // Connect reads the filter with its offset, turns it into Swedish time and compares clocks.
      const since = url.searchParams.get('criteria.changedAtMinValue');
      const floor = since ? stockholm(new Date(since)) : '';
      const pageSize = Number(url.searchParams.get('paging.pageSize') ?? 100);
      const pageIndex = Number(url.searchParams.get('paging.pageIndex') ?? 0);
      const rows = [...records.values()]
        .filter((record) => (record.changedAt ?? '') >= floor)
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
