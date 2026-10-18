// The release impact preview (strategy §4, E5, AC 36) as the release's first step runs it, in a
// process that only previews: this version's mappers and rules over every stored record, nothing
// written, and a record that cannot be mapped stops the release. A stand-in CRM, "anycrm", maps an
// office from its name and street and cannot map one without a street.
import { afterEach, describe, expect, it } from 'vitest';
import { truncate } from '../acceptance/harness.js';
import { adapterApi } from './adapter-api/index.js';
import type { Canonical, Connection } from './adapter-api/types.js';
import { startEngine } from './index.js';
import { previewInWords, previewRelease } from './preview.js';
import { clearRegistry } from './registry.js';
import { createTenant, upsertConnection } from './storage/connections.js';
import { closeDb, db } from './storage/db.js';

const URL = process.env['DATABASE_URL'] ?? '';

afterEach(async () => {
  clearRegistry();
  await closeDb();
});

/** What the database holds that a write would change: the last place given out, and the events. */
async function written(): Promise<{ seq: string; events: string }> {
  const { rows } = await db(URL).query<{ seq: string; events: string }>(
    'select (select max(seq) from items) as seq, (select count(*) from events) as events',
  );
  return rows[0] ?? { seq: '', events: '' };
}

describe('the release preview', () => {
  it('maps every stored record without writing anything, and stops the release on a record it cannot map', async () => {
    await startEngine({ port: 0 });
    await truncate();
    const api = adapterApi('anycrm');
    api.register(
      { provider: 'anycrm', datatypes: ['office'] },
      {
        office: (raw) => {
          const { id, street } = raw as { id: string; street?: string };
          if (!street) throw new Error('an office needs a street');
          return {
            data: {
              id,
              name: `Office ${id}`,
              address: { street, postal_code: null, city: 'Malmö' },
              phone: null,
              email: null,
              lat: null,
              lng: null,
              provider_extras: {},
            } as unknown as Canonical,
            officeId: id,
            remoteUpdatedAt: null,
          };
        },
      },
    );
    const tenantId = await createTenant({ displayName: 'Preview tenant', token: 'tok-preview' });
    await upsertConnection({ id: 'anycrm-1', tenantId, provider: 'anycrm', licensedOffices: [] });
    const connection: Connection = {
      id: 'anycrm-1',
      tenantId,
      provider: 'anycrm',
      credentials: null,
      licensedOffices: [],
    };
    for (const id of ['K1', 'K2', 'K3']) {
      const stored = await api.ingest(connection, 'office', id, { id, street: `Storgatan ${id}` });
      expect(stored.outcome).toBe('written');
    }
    // K1 was stored by older rules, and K2 lost the street this version's mapper needs.
    await db().query(
      `update items set data = jsonb_set(data, '{name}', '"Old name"'), content_hash = 'older'
       where remote_id = 'K1'`,
    );
    await db().query(`update items set raw = '{"id": "K2"}' where remote_id = 'K2'`);
    const before = await written();
    await closeDb();

    const report = await previewRelease(URL);

    expect(report).toMatchObject({ examined: 3, changed: 1, unchanged: 1, failed: 1 });
    expect(report.examples).toEqual([
      {
        remoteId: 'K1',
        datatype: 'office',
        connectionId: 'anycrm-1',
        changed: { name: { from: 'Old name', to: 'Office K1' } },
      },
    ]);
    expect(report.failures).toEqual([
      {
        remoteId: 'K2',
        datatype: 'office',
        connectionId: 'anycrm-1',
        errors: ['Error: an office needs a street'],
      },
    ]);
    const lines = previewInWords(report);
    expect(lines[0]).toBe(
      'Release preview: 3 records read from the database, nothing written. 1 would change, 1 stay the same, 1 fail.',
    );
    expect(lines.at(-1)).toBe(
      'The release stops: one record cannot be mapped or does not fit the schema.',
    );
    expect(await written()).toEqual(before);
  });

  it('lets the release go ahead over an empty database', async () => {
    await startEngine({ port: 0 });
    await truncate();
    await closeDb();

    const report = await previewRelease(URL);

    expect(report).toMatchObject({ examined: 0, failed: 0 });
    expect(previewInWords(report)).toEqual([
      'Release preview: 0 records read from the database, nothing written. 0 would change, 0 stay the same, 0 fail.',
      'The release may go ahead.',
    ]);
  });
});
