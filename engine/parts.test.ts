// A record's part of a page follows the record (question 227): written with it, made again when
// only its raw changes, and gone with a removal, so a page always carries the record as it is.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, TOKEN, type Harness } from '../acceptance/harness.js';
import type { Adapter, AdapterApi, Connection } from './adapter-api/types.js';
import { connectionById } from './storage/connections.js';
import { db } from './storage/db.js';

const PROVIDER = 'parts-test';
const CONNECTION = 'parts-test-1';

/** The adapter's side: a home's price onto the universal names; its note stays in raw alone. */
const mapHome = (raw: unknown) => {
  const crm = raw as { id: string; price: number };
  return {
    officeId: '100',
    remoteUpdatedAt: null,
    data: {
      id: crm.id,
      office_id: '100',
      agent_ids: [],
      area_ids: [],
      association_id: null,
      project_id: null,
      status: { id: 'ForSale', name: 'ForSale' },
      type: null,
      subtype: null,
      tenure: null,
      address: {
        street: null,
        postal_code: null,
        city: null,
        area_name: null,
        municipality: null,
        country_code: null,
      },
      lat: null,
      lng: null,
      price: crm.price,
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

type Item = { remote_id: string; deleted: boolean; raw: unknown; data: { price?: number } | null };

/** Whether every home has its part, so the page came from parts and not from raw and data. */
const allParts = async (): Promise<boolean> =>
  (await db().query<{ all: boolean }>('select bool_and(page_part is not null) as all from items'))
    .rows[0]?.all ?? false;

const page = async (): Promise<Item[]> => {
  expect(await allParts()).toBe(true);
  const response = await fetch(`${running.baseUrl}/v1/changes?datatype=property`, {
    headers: { authorization: `Bearer ${TOKEN}`, 'accept-encoding': 'gzip' },
  });
  return ((await response.json()) as { items: Item[] }).items;
};

describe("a home's part of a page", () => {
  it('carries the home as it is, through a change of raw alone and a removal', async () => {
    await api?.ingest(connection, 'property', 'H-1', { id: 'H-1', price: 100, note: 'first' });
    expect(await page()).toMatchObject([
      { remote_id: 'H-1', deleted: false, raw: { note: 'first' }, data: { price: 100 } },
    ]);

    // Same content, new raw: no new seq, and a site that fetches the home later gets the new raw.
    await api?.ingest(connection, 'property', 'H-1', { id: 'H-1', price: 100, note: 'second' });
    expect(await page()).toMatchObject([{ raw: { note: 'second' }, data: { price: 100 } }]);

    await api?.ingest(connection, 'property', 'H-1', { id: 'H-1', price: 200, note: 'second' });
    expect(await page()).toMatchObject([{ data: { price: 200 } }]);

    await api?.notFound(connection, 'property', 'H-1');
    expect(await page()).toMatchObject([{ remote_id: 'H-1', deleted: true, raw: null }]);
  });
});
