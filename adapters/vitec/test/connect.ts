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
  /** Every form call a site's visitor caused, oldest first, with the body as Connect got it. */
  forms: { path: string; body: Record<string, unknown> }[];
  /** Answer the next form call with 400 and this message, as Connect refuses a full viewing. */
  refuseNext(message: string): void;
  /** What the form endpoint answers for this estate: its viewings and time slots. */
  setForm(officeId: string, estateId: string, payload: Record<string, unknown>): void;
  /** The office groups a customer keeps in Vitec's CRM (`CRM/Officegroups/{customerId}`). */
  setGroups(
    customerId: string,
    groups: { id: string; name: string; offices: { id: string }[] }[],
  ): void;
  /** Answer 403 for this customer's office groups: the login lacks the CRM rights. */
  forbidGroups(customerId: string): void;
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
    forms: [],
    refuseNext: (message) => (refusal = message),
    setForm: (officeId, estateId, payload) => formData.set(`${officeId}/${estateId}`, payload),
    setGroups: (customerId, list) => groups.set(customerId, list),
    forbidGroups: (customerId) => groupsForbidden.add(customerId),
    maxInFlight: 0,
    close: () => Promise.resolve(),
  };
  const groups = new Map<string, unknown[]>();
  const groupsForbidden = new Set<string>();
  /** `CRM/Officegroups/{customerId}`: the stored groups, none, or a refusal. */
  const answerGroups = (
    pathname: string,
    reply: (status: number, body: unknown) => void,
  ): boolean => {
    if (!pathname.startsWith('/CRM/Officegroups/')) return false;
    const customerId = decodeURIComponent(pathname.split('/')[3] ?? '');
    if (groupsForbidden.has(customerId)) reply(403, { message: 'forbidden' });
    else reply(200, groups.get(customerId) ?? []);
    return true;
  };
  /** The calls outside `Advertising/`: the forms' calls and the office groups. */
  const answerOutsideAdvertising = (
    method: string,
    path: string,
    text: string,
    reply: (status: number, body: unknown) => void,
    noContent: () => void,
  ): boolean => answerForm(method, path, text, reply, noContent) || answerGroups(path, reply);
  let refusal: string | null = null;
  const formData = new Map<string, Record<string, unknown>>();

  /** What a form POST answers, by its path: a status and a body, or null for 204. */
  const postAnswer = (path: string): { status: number; body: unknown } | null => {
    if (refusal) {
      const message = refusal;
      refusal = null;
      return { status: 400, body: { message } };
    }
    const n = String(fake.forms.length);
    if (path.endsWith('/Valuation') || path.endsWith('/Viewing/Attend')) {
      return { status: 200, body: { contactId: `C-${n}` } };
    }
    if (path.endsWith('/interest')) return null;
    if (path === '/Contacts/UpdatePerson') return { status: 200, body: `P-${n}` };
    if (path.includes('/SearchProfile/Residential/')) return { status: 200, body: `SP-${n}` };
    return { status: 404, body: { message: 'no such form call' } };
  };

  const parseBody = (text: string): Record<string, unknown> => {
    try {
      return JSON.parse(text || '{}') as Record<string, unknown>;
    } catch {
      return {}; // an unreadable body is kept empty
    }
  };

  /**
   * The form calls (docs/forms.md), in the shapes the documentation gives: the valuation and the
   * viewing attendance answer `{ contactId }`, the interest answers 204, `Contacts/UpdatePerson`
   * and the residential search profile answer a string, and the form endpoint answers what a
   * test put there. True when the request was one of them.
   */
  const answerForm = (
    method: string,
    path: string,
    text: string,
    reply: (status: number, body: unknown) => void,
    noContent: () => void,
  ): boolean => {
    if (method === 'POST') {
      fake.forms.push({ path, body: parseBody(text) });
      const answer = postAnswer(path);
      if (answer) reply(answer.status, answer.body);
      else noContent();
      return true;
    }
    if (path.startsWith('/v2/Advertising/Form/')) {
      const [, , , , officeId, , estateId] = path.split('/');
      const payload = formData.get(`${officeId ?? ''}/${estateId ?? ''}`);
      reply(payload ? 200 : 404, payload ?? { message: 'not found' });
      return true;
    }
    return false;
  };

  /** One page of an id list, as Connect pages it: `paging.pageIndex` from 0, `count` the pages. */
  const listPage = (
    records: Map<string, Record_>,
    officeId: string,
    datatype: string,
    query: URLSearchParams,
  ): unknown => {
    const since = query.get('criteria.changedAtMinValue');
    const pageSize = Number(query.get('paging.pageSize') ?? 100);
    const pageIndex = Number(query.get('paging.pageIndex') ?? 0);
    const rows = [...records.values()]
      .filter((record) => !unlisted.has(`${officeId}/${datatype}/${record.id}`))
      .filter((record) => !since || new Date(record.changedAt ?? 0) >= new Date(since))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((record) => ({
        id: record.id,
        // A group id lists offices of several customers; each row carries the office's own.
        customerId: typeof record['customerId'] === 'string' ? record['customerId'] : officeId,
        changedAt: record.changedAt ?? null,
      }));
    return {
      index: pageIndex,
      count: Math.ceil(rows.length / pageSize),
      totalRowCount: rows.length,
      rows: rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    };
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
    const noContent = (): void => {
      inFlight -= 1;
      response.writeHead(204);
      response.end();
    };
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () =>
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
        const text = Buffer.concat(chunks).toString('utf8');
        const method = request.method ?? 'GET';
        if (answerOutsideAdvertising(method, url.pathname, text, reply, noContent)) return;
        const [, advertising, resource, officeId, id] = url.pathname.split('/');
        const datatype = resource ? RESOURCES[resource] : undefined;
        if (advertising !== 'Advertising' || !datatype || !officeId) return reply(404, {});
        if (forbidden.has(officeId)) return reply(403, { message: 'forbidden' });
        const records = bucket(officeId, datatype);
        if (id) {
          const record = records.get(id);
          return record ? reply(200, record) : reply(404, { message: 'not found' });
        }
        reply(200, listPage(records, officeId, datatype, url.searchParams));
      }, fake.delayMs),
    );
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      fake.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      fake.close = () => new Promise((done) => server.close(() => done()));
      resolve(fake);
    });
  });
}
