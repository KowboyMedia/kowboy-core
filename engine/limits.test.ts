// Limits on what a site's pull and a stored home cost, so a change that makes pages slower or the
// database grow faster fails here before it ships (Patric, 2026-10-22: "ensure that new updates
// we make don't cause perf issues, as well as database growth"). Each limit counts work, never
// time: database calls, bytes and rows give the same answer on any machine. The home is made to a
// real one's size and mix, the same on every run. A limit is raised only with a line in
// docs/decisions.md saying why; so is a table or an index added to the lists at the end.
import { readdirSync, readFileSync } from 'node:fs';
import { get } from 'node:http';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type pg from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, TOKEN, type Harness } from '../acceptance/harness.js';
import type { Adapter, AdapterApi, Connection } from './adapter-api/types.js';
import { connectionById } from './storage/connections.js';
import { db } from './storage/db.js';
import { PAGE_SIZE } from './http/changes.js';

const LIMITS = {
  /** Database calls for a pull that brings records: the token, the page, the site's last pull, the pull's line. */
  callsPerPull: 4,
  /** And for one that brings nothing, which leaves no line. */
  callsPerEmptyPull: 3,
  /**
   * What the database hands Core for a page of 100 of these homes: their parts, ready to send
   * (356,075 on 2026-10-22; 2,576,743 as text before parts).
   */
  databaseBytesPerPage: 400_000,
  /** What a site receives for that page, compressed (349,351). */
  siteBytesPerPage: 385_000,
  /**
   * What one of these homes takes in Core's tables once written: its row, its values, its part,
   * its indexes and its lines in the event log (21,709).
   */
  bytesPerHome: 24_000,
};

const PROVIDER = 'limits-test';
const CONNECTION = 'limits-test-1';

/** The same numbers on every run (mulberry32). */
function numbers(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SYLLABLES = [
  'ka',
  'vi',
  'ro',
  'sten',
  'berg',
  'lund',
  'ål',
  'ny',
  'gård',
  'hus',
  'sjö',
  'ek',
];

/**
 * A home as a CRM sends one: some 20 KB of JSON, with the mix a real one has of short fields,
 * repeated lists (images, rooms, viewings) and a few long texts.
 */
function home(n: number): Record<string, unknown> {
  const next = numbers(n + 1);
  const pick = <T>(list: T[]): T => list[Math.floor(next() * list.length)] as T;
  const word = (): string =>
    Array.from({ length: 1 + Math.floor(next() * 3) }, () => pick(SYLLABLES)).join('');
  const words = (count: number): string =>
    Array.from({ length: count }, word)
      .join(' ')
      .replace(/^./, (c) => c.toUpperCase());
  const id = `H-${String(n)}`;
  return {
    id,
    officeId: '100',
    status: pick(['ForSale', 'Coming', 'Sold']),
    address: { street: `${words(1)} ${String(1 + Math.floor(next() * 90))}`, city: words(1) },
    price: 1_000_000 + Math.floor(next() * 9_000_000),
    heading: words(6),
    shortText: words(40),
    longText: Array.from({ length: 6 }, () => words(60)).join('\n\n'),
    rooms: Array.from({ length: 8 }, () => ({
      name: words(1),
      area: Math.round(next() * 300) / 10,
      floor: Math.floor(next() * 4),
      description: words(12),
    })),
    images: Array.from({ length: 30 }, (_, index) => ({
      id: `${id}-${String(index)}`,
      url: `https://images.example.test/${id}/${Math.floor(next() * 1e12).toString(36)}.jpg`,
      width: 2048,
      height: 1365,
      category: pick(['Exterior', 'Interior', 'Plan']),
      caption: words(5),
    })),
    viewings: Array.from({ length: 3 }, () => ({
      start: new Date(Date.UTC(2026, 10, 1 + Math.floor(next() * 28), 15)).toISOString(),
      note: words(4),
    })),
    facts: Object.fromEntries(Array.from({ length: 40 }, (_, k) => [`fact${String(k)}`, words(3)])),
  };
}

/** The adapter's side: the CRM's fields copied onto the universal names. */
const mapHome = (raw: unknown) => {
  const crm = raw as Record<string, unknown>;
  return {
    officeId: '100',
    remoteUpdatedAt: null,
    data: {
      id: crm['id'],
      office_id: '100',
      agent_ids: [],
      area_ids: [],
      association_id: null,
      project_id: null,
      status: { id: crm['status'], name: crm['status'] },
      type: null,
      subtype: null,
      tenure: null,
      address: {
        street: (crm['address'] as { street: string }).street,
        postal_code: null,
        city: null,
        area_name: null,
        municipality: null,
        country_code: null,
      },
      lat: null,
      lng: null,
      price: crm['price'],
      final_price: null,
      currency: 'SEK',
      fee: null,
      living_space: null,
      additional_space: null,
      rooms: null,
      buildings: [],
      images: [],
      viewings: [],
      bidding: { bids: [], is_active: null, is_verified: null },
      heading: crm['heading'],
      short_text: crm['shortText'],
      long_text: crm['longText'],
      surroundings: { rooms: crm['rooms'], images: crm['images'], facts: crm['facts'] },
      provider_extras: {},
    },
  };
};

let api: AdapterApi | null = null;
const adapter: Adapter = {
  manifest: { provider: PROVIDER, datatypes: ['property'] },
  mappers: { property: mapHome } as unknown as Adapter['mappers'],
  start(given) {
    api = given;
  },
};

/** Every call the pool answers while `body` runs: its SQL and how many bytes came back. */
async function counted(
  body: () => Promise<void>,
): Promise<{ text: string; values: unknown[]; bytes: number }[]> {
  const pool = db();
  const query = pool.query.bind(pool) as (...args: unknown[]) => Promise<pg.QueryResult>;
  const calls: { text: string; values: unknown[]; bytes: number }[] = [];
  const spy = vi.spyOn(pool, 'query').mockImplementation((async (...args: unknown[]) => {
    const result = await query(...args);
    const [first, second] = args as [string | { text: string; values?: unknown[] }, unknown[]?];
    const text = typeof first === 'string' ? first : first.text;
    const values = (typeof first === 'string' ? second : first.values) ?? [];
    let bytes = 0;
    for (const row of result.rows as Record<string, unknown>[]) {
      for (const value of Object.values(row)) {
        if (Buffer.isBuffer(value)) bytes += value.length;
        else if (value !== null && value !== undefined) bytes += Buffer.byteLength(String(value));
      }
    }
    calls.push({ text, values, bytes });
    return result;
  }) as unknown as typeof pool.query);
  try {
    await body();
  } finally {
    spy.mockRestore();
  }
  return calls;
}

/** One pull as a site makes it, with what came over the wire. */
function pull(
  baseUrl: string,
  after: number,
): Promise<{ wire: number; page: { items: unknown[]; next_after: number } }> {
  return new Promise((resolve, reject) => {
    get(
      `${baseUrl}/v1/changes?datatype=property&after=${String(after)}&limit=${String(PAGE_SIZE)}`,
      {
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'accept-encoding': 'gzip',
          'x-core-client': 'limits-test',
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const body = Buffer.concat(chunks);
          const text = response.headers['content-encoding'] === 'gzip' ? gunzipSync(body) : body;
          resolve({ wire: body.length, page: JSON.parse(text.toString()) });
        });
      },
    ).on('error', reject);
  });
}

/** The bytes Core's own tables take now. */
async function tableBytes(): Promise<number> {
  const { rows } = await db().query<{ bytes: string }>(
    'select sum(pg_total_relation_size(quote_ident(name)))::bigint as bytes from unnest($1::text[]) as name',
    [Object.keys(TABLES)],
  );
  return Number(rows[0]?.bytes ?? 0);
}

let running: Harness;
let connection: Connection;

beforeEach(async () => {
  running = await harness({
    adapters: [adapter],
    connections: [{ id: CONNECTION, provider: PROVIDER, licensedOffices: ['100'] }],
  });
  connection = (await connectionById(CONNECTION)) as Connection;
});

afterEach(async () => {
  await running.stop();
  api = null;
});

/** Write `count` homes as the adapter hands them to the engine. */
async function write(count: number): Promise<void> {
  for (let n = 0; n < count; n += 1) {
    const result = await api?.ingest(connection, 'property', `H-${String(n)}`, home(n));
    expect(result).toEqual(expect.objectContaining({ outcome: 'written' }));
  }
}

describe('a pull', () => {
  it('asks the database a fixed number of times, whatever the page holds', async () => {
    await write(PAGE_SIZE + 1);

    const full = await counted(async () => {
      expect((await pull(running.baseUrl, 0)).page.items).toHaveLength(PAGE_SIZE);
    });
    const { rows } = await db().query<{ seq: string }>('select max(seq) as seq from items');
    const empty = await counted(async () => {
      expect((await pull(running.baseUrl, Number(rows[0]?.seq))).page.items).toHaveLength(0);
    });

    expect(full.length).toBeLessThanOrEqual(LIMITS.callsPerPull);
    expect(empty.length).toBeLessThanOrEqual(LIMITS.callsPerEmptyPull);
    expect(empty.filter((call) => /insert into events/i.test(call.text))).toHaveLength(0);
  });

  it('reads its page from an index, already in order', async () => {
    await write(PAGE_SIZE + 1);
    const calls = await counted(async () => {
      await pull(running.baseUrl, 0);
    });
    // The page is the call that brought the most back.
    const page = calls.reduce((most, call) => (call.bytes > most.bytes ? call : most));

    const client = await db().connect();
    try {
      await client.query('begin');
      // With no other way open, a query no index serves shows a whole-table read or a sort.
      await client.query('set local enable_seqscan = off');
      await client.query('set local enable_sort = off');
      const { rows } = await client.query<{ 'QUERY PLAN': unknown }>(
        `explain (format json) ${page.text}`,
        page.values,
      );
      const plan = JSON.stringify(rows[0]?.['QUERY PLAN']);
      expect(plan).not.toContain('"Seq Scan"');
      expect(plan).not.toContain('"Sort"');
      await client.query('rollback');
    } finally {
      client.release();
    }
  });

  it('carries a page of 100 homes in a set number of bytes, from the database and to the site', async () => {
    await write(PAGE_SIZE);
    let wire = 0;
    const calls = await counted(async () => {
      wire = (await pull(running.baseUrl, 0)).wire;
    });
    const fromDatabase = calls.reduce((sum, call) => sum + call.bytes, 0);

    expect(fromDatabase, 'bytes from the database').toBeLessThanOrEqual(
      LIMITS.databaseBytesPerPage,
    );
    expect(wire, 'bytes to the site').toBeLessThanOrEqual(LIMITS.siteBytesPerPage);
  });
});

describe('a stored home', () => {
  it('takes a set number of bytes in the database, its event log lines included', async () => {
    const before = await tableBytes();
    await write(200);
    const perHome = Math.round(((await tableBytes()) - before) / 200);

    expect(perHome, 'bytes a home').toBeLessThanOrEqual(LIMITS.bytesPerHome);
  });
});

/**
 * Every table of the engine's, and what keeps it from growing without end. A new table is added
 * here with its bound, so nothing is stored that nothing ever clears.
 */
const TABLES: Record<string, string> = {
  tenants: 'one a brokerage',
  connections: 'one a CRM login',
  subscribers: 'one a website',
  items: 'one a record the CRMs list; removed records go after their days',
  events: 'the event log, kept its days (EVENT_RETENTION_DAYS)',
  heartbeats: 'one a process',
  lifecycle_events: 'one a connection change, cleared once delivered',
  health_results: 'pruned to their days',
  error_reports: 'one an error kind, a line a day',
  jobs: 'one a job a person starts',
  alert_state: 'one an alert',
  admin_logins: 'one a sign-in link, gone once used or old',
  admin_sessions: 'one a signed-in browser, gone when it ends',
  submissions: 'one a form, kept its days',
  panel_problems: 'one a problem the admin area shows',
  migrations: 'one a migration',
};

/**
 * The indexes of the two tables every record and every pull write to. Each one costs every write
 * and takes its own room, so a new one is added here with why it pays.
 */
const INDEXES: Record<string, string[]> = {
  items: ['items_cursor', 'items_pkey', 'items_seq'],
  events: [
    'events_at',
    'events_bell',
    'events_correlation',
    'events_entity',
    'events_id',
    'events_written',
    'events_written_fetched',
  ],
};

describe("the engine's tables", () => {
  it('are each listed with what bounds them', () => {
    const folder = join(import.meta.dirname, 'storage', 'migrations');
    // The migration runner's own table, made before any migration runs.
    const created = new Set<string>(['migrations']);
    for (const file of readdirSync(folder).sort()) {
      const sql = readFileSync(join(folder, file), 'utf8');
      for (const [, name] of sql.matchAll(/create table (?:if not exists )?(\w+)/gi)) {
        created.add(name as string);
      }
      for (const [, name] of sql.matchAll(/drop table (?:if exists )?(\w+)/gi)) {
        created.delete(name as string);
      }
    }
    expect([...created].sort()).toEqual(Object.keys(TABLES).sort());
  });

  it('that grow with the records have only the indexes listed', async () => {
    const { rows } = await db().query<{ tablename: string; indexname: string }>(
      `select tablename, indexname from pg_indexes
       where schemaname = 'public' and tablename = any($1::text[]) order by indexname`,
      [Object.keys(INDEXES)],
    );
    for (const [table, indexes] of Object.entries(INDEXES)) {
      expect(rows.filter((row) => row.tablename === table).map((row) => row.indexname)).toEqual(
        indexes,
      );
    }
  });
});
