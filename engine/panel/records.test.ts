// Records and manual sync (design B2, images 01 to 37): the records list with its filters and
// their counts, one record's page, and a sync that fetches again, recomputes or sends. A stand-in
// CRM, "somecrm", keeps its records in memory and maps them onto the universal names from the
// dummy golden records. Asked to fetch again, it puts the records on its own fetch list, as a real
// CRM's code does, and the test empties that list; it reads only, and its form handler must never
// be reached. Nothing here calls a real CRM.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { harness, TENANT, type Harness } from '../../acceptance/harness.js';
import { db } from '../storage/db.js';
import { tokenHmac } from '../storage/crypto.js';
import { addSubscriber, createTenant, upsertConnection } from '../storage/connections.js';
import { runNextJob } from '../jobs.js';
import type {
  Adapter,
  AdapterApi,
  Canonical,
  Connection,
  Datatype,
  MappedRecord,
} from '../adapter-api/types.js';
import { COOKIE } from './auth.js';
import { differences, type RecordList, type RecordPage } from './recordlist.js';
import type { SyncStarted, SyncView } from './sync.js';

let core: Harness;
const SESSION = 'records-test-session';

type Raw = {
  id: string;
  street?: string;
  name?: string;
  office?: string;
  offices?: string[];
  agents?: string[];
  price?: number;
};

const template = (datatype: Datatype): Canonical =>
  JSON.parse(
    readFileSync(resolve(`golden/fake/${datatype}/basic/canonical.json`), 'utf8'),
  ) as Canonical;

const property = (raw: unknown): MappedRecord => {
  const one = raw as Raw;
  const base = template('property');
  return {
    officeId: one.office ?? null,
    remoteUpdatedAt: '2026-10-15T09:58:12+02:00',
    data: {
      ...base,
      id: one.id,
      address: { ...(base['address'] as Canonical), street: one.street ?? null },
      office_id: one.office ?? null,
      agent_ids: one.agents ?? [],
      price: one.price ?? 4950000,
    },
  };
};

const agent = (raw: unknown): MappedRecord => {
  const one = raw as Raw;
  return {
    officeId: one.offices?.[0] ?? null,
    remoteUpdatedAt: null,
    data: {
      ...template('agent'),
      id: one.id,
      name: one.name ?? null,
      office_ids: one.offices,
      // The same offices again as a list with parts, so a change of office changes both.
      offices: (one.offices ?? []).map((office_id) => ({
        is_visible_in_staff_list: null,
        office_id,
        order: null,
        phone: null,
      })),
    },
  };
};

const office = (raw: unknown): MappedRecord => {
  const one = raw as Raw;
  return {
    officeId: one.id,
    remoteUpdatedAt: null,
    data: { ...template('office'), id: one.id, name: one.name ?? null },
  };
};

/** What the stand-in CRM holds, by `<connection> <datatype> <id>`. */
const crm = new Map<string, Raw>();
/** The stand-in CRM's own fetch list, as its code keeps one. */
let fetchList: { connection: Connection; datatype: Datatype; id: string }[] = [];
const asked: {
  refetches: { connection: string; records: string[] }[];
  resyncs: { connection: string; datatype: Datatype | null }[];
  sent: number;
} = { refetches: [], resyncs: [], sent: 0 };
let api: AdapterApi | null = null;

const TYPES: Datatype[] = ['office', 'agent', 'property'];

const somecrm: Adapter = {
  manifest: { provider: 'somecrm', datatypes: TYPES },
  mappers: { property, agent, office },
  start(given) {
    api = given;
    given.onLifecycle(async (event) => {
      if (event.type === 'refetch') {
        asked.refetches.push({
          connection: event.connection.id,
          records: event.records.map((one) => one.remoteId),
        });
        for (const one of event.records)
          fetchList.push({
            connection: event.connection,
            datatype: one.datatype,
            id: one.remoteId,
          });
      }
      if (event.type === 'resync') {
        asked.resyncs.push({ connection: event.connection.id, datatype: event.datatype ?? null });
        for (const datatype of event.datatype ? [event.datatype] : TYPES) {
          const ids = [...crm.keys()]
            .filter((key) => key.startsWith(`${event.connection.id} ${datatype} `))
            .map((key) => key.split(' ')[2] ?? '');
          await given.presentIds(event.connection, datatype, { officeId: null }, ids);
          for (const id of ids) fetchList.push({ connection: event.connection, datatype, id });
        }
      }
    });
  },
  admin: {
    credentials: [],
    act: () => Promise.resolve({ message: '' }),
    queueCount: (connections, scope) => {
      const ids = new Set(connections.map((one) => one.id));
      const waiting = fetchList.filter(
        (one) =>
          ids.has(one.connection.id) &&
          (!scope.datatypes || scope.datatypes.includes(one.datatype)) &&
          (!scope.remoteId || scope.remoteId === one.id),
      ).length;
      return Promise.resolve({ waiting, failed: 0 });
    },
  },
  submit: () => {
    asked.sent += 1;
    return Promise.resolve({ outcome: 'delivered' });
  },
};

/** The stand-in CRM's code works through its fetch list: what the CRM has is written, the rest removed. */
async function drain(): Promise<void> {
  const list = fetchList;
  fetchList = [];
  for (const one of list) {
    const raw = crm.get(`${one.connection.id} ${one.datatype} ${one.id}`);
    if (raw) await api?.ingest(one.connection, one.datatype, one.id, raw);
    else await api?.notFound(one.connection, one.datatype, one.id);
  }
}

let other = 0;
const connections: Record<string, Connection> = {};

async function put(connection: string, datatype: Datatype, raw: Raw): Promise<void> {
  crm.set(`${connection} ${datatype} ${raw.id}`, raw);
  const known = connections[connection];
  if (!known || !api) throw new Error('no connection');
  await api.ingest(known, datatype, raw.id, raw);
}

beforeAll(async () => {
  core = await harness({ adapters: [somecrm], connections: [] });
});
afterAll(async () => {
  await core.stop();
});
beforeEach(async () => {
  crm.clear();
  fetchList = [];
  asked.refetches = [];
  asked.resyncs = [];
  asked.sent = 0;
  await db().query(
    'truncate submissions, events, admin_sessions, lifecycle_events, jobs, panel_problems',
  );
  await db().query('delete from items');
  await db().query('delete from connections');
  await db().query('delete from subscribers where tenant_id <> $1', [TENANT]);
  await db().query('delete from tenants where id <> $1', [TENANT]);
  await db().query('update tenants set active = true, display_name = $2 where id = $1', [
    TENANT,
    'Lindqvist & Holm Mäkleri',
  ]);
  await db().query("update subscribers set label = 'lindqvistholm.se', last_pull_at = null");
  await db().query(
    `insert into admin_sessions (token_hmac, email, expires_at) values ($1, 'tester@kowboy.se', now() + interval '1 day')`,
    [tokenHmac(SESSION, core.engine.config.credentialsKey)],
  );
  other = await createTenant({ displayName: 'Mäklarbyrån Ljungström', token: 'other-token' });
  // The harness's own bell receiver takes this website's change notices too.
  const { rows: bell } = await db().query<{ bell_url: string }>(
    'select bell_url from subscribers where tenant_id = $1 limit 1',
    [TENANT],
  );
  await addSubscriber({
    tenantId: other,
    label: 'ljungstrommakleri.se',
    bellUrl: bell[0]?.bell_url ?? '',
    bellSecret: 'secret',
  });
  for (const [id, tenantId, name] of [
    ['lh', TENANT, 'Lindqvist & Holm Somecrm'],
    ['lj', other, 'Ljungström Somecrm'],
  ] as const) {
    await upsertConnection({ id, tenantId, provider: 'somecrm', name });
    connections[id] = { id, tenantId, provider: 'somecrm', credentials: null, licensedOffices: [] };
  }
  await put('lh', 'office', { id: 'BR', name: 'Bromma' });
  await put('lh', 'office', { id: 'SO', name: 'Solna' });
  await put('lh', 'agent', { id: 'A1', name: 'Maria Holm', offices: ['BR'] });
  await put('lh', 'agent', { id: 'A2', name: 'Erik Sandell', offices: ['BR', 'SO'] });
  await put('lh', 'property', {
    id: 'P1',
    street: 'Brommaplan 4',
    office: 'BR',
    agents: ['A1', 'A2'],
  });
  await put('lh', 'property', { id: 'P2', street: 'Åkeshovsvägen 2', office: 'BR' });
  await put('lh', 'property', { id: 'P3', street: 'Zinkens väg 9', office: 'SO' });
  await put('lj', 'office', { id: 'VA', name: 'Västerås' });
  await put('lj', 'property', { id: 'K8', street: 'Kopparbergsvägen 8', office: 'VA' });
});

async function call(
  path: string,
  body?: unknown,
  signedIn = true,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${core.baseUrl}/v1/panel${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(signedIn ? { cookie: `${COOKIE}=${SESSION}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function list(query = ''): Promise<RecordList> {
  const { status, json } = await call(`/records${query}`);
  expect(status).toBe(200);
  return json as unknown as RecordList;
}

async function record(connection: string, datatype: string, id: string): Promise<RecordPage> {
  const { status, json } = await call(`/records/${connection}/${datatype}/${id}`);
  expect(status).toBe(200);
  return json as unknown as RecordPage;
}

async function sync(body: unknown): Promise<SyncStarted> {
  const { status, json } = await call('/records/sync', body);
  expect(status).toBe(202);
  return json as unknown as SyncStarted;
}

async function state(ticket: SyncStarted): Promise<SyncView> {
  const query = new URLSearchParams({ what: ticket.what, at: ticket.at });
  for (const id of ticket.events) query.append('event', String(id));
  for (const id of ticket.tenants) query.append('tenant', String(id));
  if (ticket.job !== null) query.set('job', String(ticket.job));
  if (ticket.sent !== null) query.set('sent', String(ticket.sent));
  const { status, json } = await call(`/records/sync?${query.toString()}`);
  expect(status).toBe(200);
  return json as unknown as SyncView;
}

describe('the records list', () => {
  it('answers only a signed-in person', async () => {
    expect((await call('/records', undefined, false)).status).toBe(401);
    expect((await call('/records/lh/property/P1', undefined, false)).status).toBe(401);
    expect((await call('/records/sync?what=send&at=2026-10-15', undefined, false)).status).toBe(
      401,
    );
    expect((await call('/records/sync', { what: 'send', filter: {} }, false)).status).toBe(401);
  });

  it('lists every record by name, in Swedish order, with each filter counted', async () => {
    const all = await list();
    expect(all.total).toBe(9);
    expect(all.rows.map((row) => row.name)).toEqual([
      'Bromma',
      'Brommaplan 4',
      'Erik Sandell',
      'Kopparbergsvägen 8',
      'Maria Holm',
      'Solna',
      'Västerås',
      'Zinkens väg 9',
      'Åkeshovsvägen 2',
    ]);
    expect(all.crms).toEqual(['Somecrm']);
    const erik = all.rows.find((row) => row.id === 'A2');
    expect(erik?.offices).toEqual(['Bromma', 'Solna']);
    expect(erik?.tenant.name).toBe('Lindqvist & Holm Mäkleri');
    expect(all.tenants.map((one) => [one.name, one.count])).toEqual([
      ['Lindqvist & Holm Mäkleri', 7],
      ['Mäklarbyrån Ljungström', 2],
    ]);
    expect(all.tenants[0]?.connections).toEqual([
      { id: 'lh', name: 'Lindqvist & Holm Somecrm', crm: 'Somecrm' },
    ]);
    expect(all.types.find((one) => one.datatype === 'property')?.count).toBe(4);

    // A filter counts the other filters' choices within it, and never its own away.
    const bromma = await list(`?tenant=${TENANT}&office=lh:BR&type=property`);
    expect(bromma.rows.map((row) => row.id)).toEqual(['P1', 'P2']);
    expect(bromma.tenants.map((one) => one.count)).toEqual([2, 0]);
    expect(bromma.offices.map((one) => [one.name, one.count])).toEqual([
      ['Bromma', 2],
      ['Solna', 1],
    ]);
    expect(bromma.types.find((one) => one.datatype === 'agent')?.count).toBe(2);
  });

  it('leaves removed records out unless asked, and finds one by its id either way', async () => {
    crm.delete('lj property K8');
    if (connections['lj']) await api?.notFound(connections['lj'], 'property', 'K8');
    expect((await list()).total).toBe(8);
    const withRemoved = await list('?removed=1');
    expect(withRemoved.total).toBe(9);
    expect(withRemoved.removed).toBe(1);
    expect(withRemoved.rows.find((row) => row.id === 'K8')).toMatchObject({
      name: 'Kopparbergsvägen 8',
      removed: true,
    });
    expect((await list('?id=K8')).rows.map((row) => row.removed)).toEqual([true]);
    expect((await list('?id=NOPE')).total).toBe(0);
  });

  it('comes 25 to a page', async () => {
    for (let n = 0; n < 30; n += 1) {
      await put('lh', 'property', { id: `X${String(n)}`, street: `Gata ${String(n)}` });
    }
    const second = await list('?page=2');
    expect(second.total).toBe(39);
    expect(second.page).toBe(2);
    expect(second.rows).toHaveLength(14);
  });
});

describe("a record's page", () => {
  it('shows its fields with links, its website text, what its CRM sent and its changes', async () => {
    await put('lh', 'property', {
      id: 'P1',
      street: 'Brommaplan 4',
      office: 'BR',
      agents: ['A1', 'A2'],
      price: 4500000,
    });
    const page = await record('lh', 'property', 'P1');
    expect(page.name).toBe('Brommaplan 4');
    expect(page.connection).toEqual({ id: 'lh', name: 'Lindqvist & Holm Somecrm', crm: 'Somecrm' });
    expect(page.tenant.name).toBe('Lindqvist & Holm Mäkleri');
    expect(page.offices).toEqual(['Bromma']);
    expect(page.removed).toBe(false);
    expect(page.remoteUpdatedAt).not.toBeNull();
    const agents = page.fields.find((one) => one.key === 'agent_ids');
    expect(agents?.links.map((one) => one.name)).toEqual(['Maria Holm', 'Erik Sandell']);
    expect(page.fields.find((one) => one.key === 'office_id')?.links[0]).toEqual({
      name: 'Bromma',
      connection: 'lh',
      datatype: 'office',
      id: 'BR',
    });
    expect(page.fields.some((one) => one.key === 'display')).toBe(false);
    expect(page.texts.length).toBeGreaterThan(0);
    expect(page.raw).toMatchObject({ id: 'P1', price: 4500000 });
    expect(page.changeDays).toBe(core.engine.config.eventRetentionDays);
    expect(page.changes.map((one) => one.kind)).toEqual(['fetched', 'first']);
    expect(page.changes[0]?.fields).toContainEqual({ key: 'price', from: 4950000, to: 4500000 });
    // An object opens into one row per part, and a website text keeps its own name.
    expect(page.fields.find((one) => one.key === 'address.street')?.value).toBe('Brommaplan 4');
    expect(page.fields.some((one) => one.key === 'address')).toBe(false);
    expect(
      page.changes[0]?.fields.every((one) => one.key !== 'price' || one.from === 4950000),
    ).toBe(true);
    expect(page.changes[0]?.fields.some((one) => one.key.startsWith('display.'))).toBe(true);
  });

  it('lists only the parts of a changed field that differ, each by its path', () => {
    expect(
      differences(
        'display.sections',
        [{ header: 'Fee', items: [{ label: 'Fee', value: '3 350 kr' }] }],
        [{ header: 'Fee', items: [{ label: 'Fee', value: '3 412 kr' }] }],
      ),
    ).toEqual([{ key: 'display.sections[0].items[0].value', from: '3 350 kr', to: '3 412 kr' }]);
    expect(differences('fee', { amount: 3350, type: null }, { amount: 3412, type: null })).toEqual([
      { key: 'fee.amount', from: 3350, to: 3412 },
    ]);
    expect(differences('office_ids', ['BR'], ['SO'])).toEqual([
      { key: 'office_ids', from: ['BR'], to: ['SO'] },
    ]);
    expect(differences('fee', null, { amount: 1 })).toEqual([
      { key: 'fee', from: null, to: { amount: 1 } },
    ]);
  });

  it('shows a removed record from what its CRM last sent, and until when Core keeps it', async () => {
    if (connections['lj']) await api?.notFound(connections['lj'], 'property', 'K8');
    const page = await record('lj', 'property', 'K8');
    expect(page.removed).toBe(true);
    expect(page.name).toBe('Kopparbergsvägen 8');
    expect(page.fields.find((one) => one.key === 'price')?.value).toBe(4950000);
    const removedAt = Date.parse(page.removedAt ?? '');
    expect(Date.parse(page.keptUntil ?? '') - removedAt).toBe(90 * 86_400_000);
    expect(page.changes[0]?.kind).toBe('removed');
  });

  it('is missing for a record Core does not hold', async () => {
    expect((await call('/records/lh/property/NOPE')).status).toBe(404);
    expect((await call('/records/lh/nothing/P1')).status).toBe(404);
  });
});

describe('manual sync', () => {
  it('refuses a choice it cannot take', async () => {
    expect((await call('/records/sync', { what: 'delete', filter: {} })).status).toBe(400);
    const many = Array.from({ length: 501 }, (_, n) => ({
      connection: 'lh',
      datatype: 'property',
      id: `X${String(n)}`,
    }));
    expect((await call('/records/sync', { what: 'send', records: many })).status).toBe(400);
    expect(
      (
        await call('/records/sync', {
          what: 'fetch',
          records: [{ connection: 'lh', datatype: 'property', id: 'NOPE' }],
        })
      ).status,
    ).toBe(404);
    expect((await call('/records/sync?what=fetch&at=never')).status).toBe(400);
  });

  it('fetches picked records again through their CRM code, which removes what its CRM lost', async () => {
    crm.delete('lj property K8');
    await put('lh', 'agent', { id: 'A2', name: 'Erik Sandell', offices: ['BR'] });
    crm.set('lh agent A1', { id: 'A1', name: 'Maria Holm', offices: ['SO'] });
    crm.set('lh agent A2', { id: 'A2', name: 'Erik Sandell', offices: ['SO'] });
    const started = await sync({
      what: 'fetch',
      records: [
        { connection: 'lj', datatype: 'property', id: 'K8' },
        { connection: 'lh', datatype: 'agent', id: 'A1' },
        { connection: 'lh', datatype: 'agent', id: 'A2' },
      ],
    });
    expect(started).toMatchObject({ what: 'fetch', count: 3, mode: 'refetch', job: null });
    expect(started.events).toHaveLength(2);
    expect(started.tenants.sort()).toEqual([TENANT, other].sort());
    expect(started.connections.map((one) => one.name)).toEqual([
      'Lindqvist & Holm Somecrm',
      'Ljungström Somecrm',
    ]);
    expect((await state(started)).state).toBe('working');

    await core.deliver();
    expect(asked.refetches).toContainEqual({ connection: 'lh', records: ['A1', 'A2'] });
    const queued = await state(started);
    expect(queued.state).toBe('working');
    expect(queued.waiting).toBe(3);

    await drain();
    const done = await state(started);
    expect(done.state).toBe('done');
    expect(done.fetched).toMatchObject({
      asked: 3,
      addedCount: 0,
      removedCount: 1,
      removed: [{ datatype: 'property', name: 'Kopparbergsvägen 8' }],
      changed: 2,
    });
    // The change that names records comes first, before the same change as a list with parts.
    expect(done.fetched?.common[0]).toEqual({
      key: 'office_ids',
      from: ['Bromma'],
      to: ['Solna'],
    });
    expect(done.fetched?.common.map((one) => one.key)).toContain('offices');
    expect(done.writtenAt).not.toBeNull();
    expect(done.sites.every((site) => !site.current)).toBe(true);

    // A website that fetches afterwards is up to date.
    await db().query('update subscribers set last_pull_at = now()');
    expect((await state(started)).sites.every((site) => site.current)).toBe(true);
    expect(asked.sent).toBe(0);
  });

  it("has a CRM list a tenant's records afresh, and fetches the new ones", async () => {
    crm.set('lh property P4', { id: 'P4', street: 'Kungsängsgatan 21', office: 'SO' });
    const started = await sync({
      what: 'fetch',
      filter: { tenants: [TENANT], types: ['property'], offices: [], id: '' },
    });
    expect(started).toMatchObject({ count: 3, mode: 'resync', tenants: [TENANT] });
    await core.deliver();
    expect(asked.resyncs).toEqual([{ connection: 'lh', datatype: 'property' }]);
    await drain();
    const done = await state(started);
    expect(done.state).toBe('done');
    expect(done.fetched).toMatchObject({
      asked: null,
      added: [{ datatype: 'property', name: 'Kungsängsgatan 21' }],
      removedCount: 0,
    });
    expect(done.sites.map((site) => site.label)).toEqual(['lindqvistholm.se']);
  });

  it('asks again only for the records an office filter keeps', async () => {
    const started = await sync({
      what: 'fetch',
      filter: { tenants: [], types: [], offices: ['lh:SO'], id: '' },
    });
    expect(started).toMatchObject({ count: 3, mode: 'refetch' });
    await core.deliver();
    expect(asked.refetches).toEqual([{ connection: 'lh', records: ['SO', 'A2', 'P3'] }]);
    expect(asked.resyncs).toEqual([]);
  });

  it('prepares the website text again as a job, and says how far it got', async () => {
    const started = await sync({
      what: 'recompute',
      filter: { tenants: [], types: ['property'], offices: [], id: '' },
    });
    expect(started).toMatchObject({ what: 'recompute', count: 4, events: [] });
    expect(started.job).not.toBeNull();
    expect((await state(started)).state).toBe('working');

    expect(await runNextJob()).toBe(true);
    const done = await state(started);
    expect(done.state).toBe('done');
    expect(done.recomputed).toEqual({ examined: 4, changed: 0, unchanged: 4, failed: 0 });
    // Nothing changed, so there was nothing for a website to fetch.
    expect(done.writtenAt).toBeNull();
    expect(done.sites.every((site) => site.current)).toBe(true);
    expect(asked.refetches).toEqual([]);
  });

  it('sends records to the websites again exactly as Core has them', async () => {
    const before = await db().query<{ seq: string }>(
      "select seq from items where connection_id = 'lh' and datatype in ('agent', 'office')",
    );
    const highest = Math.max(...before.rows.map((row) => Number(row.seq)));
    const rang = core.bells.length;
    const started = await sync({
      what: 'send',
      filter: { tenants: [TENANT], types: ['agent', 'office'], offices: [], id: '' },
    });
    expect(started).toMatchObject({ what: 'send', count: 4, sent: 4, tenants: [TENANT] });
    const after = await db().query<{ seq: string }>(
      "select seq from items where connection_id = 'lh' and datatype in ('agent', 'office')",
    );
    expect(after.rows.every((row) => Number(row.seq) > highest)).toBe(true);
    const waiting = await state(started);
    expect(waiting.state).toBe('done');
    expect(waiting.sites).toEqual([
      expect.objectContaining({ label: 'lindqvistholm.se', current: false }) as unknown,
    ]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await db().query('update subscribers set last_pull_at = now()');
    expect((await state(started)).sites[0]?.current).toBe(true);
    expect(core.bells.length).toBeGreaterThanOrEqual(rang);
    expect(asked.refetches).toEqual([]);
    expect(asked.resyncs).toEqual([]);
    expect(asked.sent).toBe(0);
  });

  it('keeps when a record last changed when a fetch finds it unchanged', async () => {
    await put('lh', 'agent', { id: 'A9', name: 'Stina Berg', offices: ['SO'] });
    await db().query(
      "update items set updated_at = '2026-10-01T08:00:00Z' where connection_id = 'lh' and remote_id = 'A9'",
    );
    await put('lh', 'agent', { id: 'A9', name: 'Stina Berg', offices: ['SO'] });
    const { rows } = await db().query<{ updated_at: Date }>(
      "select updated_at from items where connection_id = 'lh' and remote_id = 'A9'",
    );
    expect(rows[0]?.updated_at.toISOString()).toBe('2026-10-01T08:00:00.000Z');
  });

  it('has a whole tenant’s websites rebuild from the start when all its records are sent', async () => {
    const watermark = async (): Promise<number> => {
      const { rows } = await db().query<{ purge_watermark: string }>(
        'select purge_watermark from tenants where id = $1',
        [TENANT],
      );
      return Number(rows[0]?.purge_watermark);
    };
    const before = await watermark();
    const { rows: top } = await db().query<{ seq: string }>('select max(seq) as seq from items');
    const rang = core.bells.length;
    const started = await sync({
      what: 'send',
      filter: { tenants: [TENANT], types: [], offices: [], id: '' },
    });
    expect(started).toMatchObject({ what: 'send', tenants: [TENANT] });
    expect(started.sent).toBe(started.count);
    // A website fetching from a cursor below the watermark starts again from nothing, so it also
    // drops what Core does not hold for the tenant.
    expect(await watermark()).toBeGreaterThan(Math.max(before, Number(top[0]?.seq)));
    // Told at once, or, inside the bell's window, held as a rebuild for the next round.
    const { rows: held } = await db().query<{ bell_pending: string | null }>(
      'select bell_pending from subscribers where tenant_id = $1',
      [TENANT],
    );
    expect(
      core.bells.length > rang || held.every((row) => row.bell_pending === 'forcerefresh'),
    ).toBe(true);
    expect(asked.refetches).toEqual([]);
    expect(asked.resyncs).toEqual([]);
  });
});
