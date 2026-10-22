// A recompute's pages (question 74): the unsold records first and the sold last, a page at a time
// by seq. A page whose records are all of the other kind comes back empty while more follow, and
// the pass goes on past it.
import { afterEach, describe, expect, it } from 'vitest';
import { truncate } from '../../acceptance/harness.js';
import { startEngine } from '../index.js';
import { createTenant, upsertConnection } from './connections.js';
import { closeDb, db } from './db.js';
import { scopeBatch } from './items.js';

afterEach(async () => {
  await closeDb();
});

/** Every page of one pass, as the remote ids each page brought. */
async function pass(sold: boolean, limit: number): Promise<string[][]> {
  const pages: string[][] = [];
  let afterSeq: number | null = 0;
  while (afterSeq !== null) {
    const { items, next } = await scopeBatch({}, sold, afterSeq, limit);
    pages.push(items.map((item) => item.remote_id));
    afterSeq = next;
  }
  return pages;
}

describe('a recompute page', () => {
  it('goes on past a page with none of the records it wants', async () => {
    const engine = await startEngine({ port: 0 });
    try {
      await truncate();
      const tenantId = await createTenant({ displayName: 'Pages tenant', token: 'tok-pages' });
      await upsertConnection({ id: 'anycrm-1', tenantId, provider: 'anycrm', licensedOffices: [] });
      // By seq: three sold, then sold and unsold mixed, then one deleted, which no page brings.
      const records: [string, boolean, boolean][] = [
        ['S1', true, false],
        ['S2', true, false],
        ['S3', true, false],
        ['S4', true, false],
        ['U1', false, false],
        ['S5', true, false],
        ['U2', false, false],
        ['U3', false, true],
      ];
      for (const [index, [id, sold, deleted]] of records.entries()) {
        await db().query(
          `insert into items (tenant_id, connection_id, datatype, remote_id, seq, deleted,
                              content_hash, raw, data, rules_version)
           values ($1, 'anycrm-1', 'property', $2, $3, $4, 'hash', '{}', $5, 'rules')`,
          [tenantId, id, index + 1, deleted, { id, sold_at: sold ? '2026-09-01' : null }],
        );
      }

      expect(await pass(false, 3)).toEqual([[], ['U1'], ['U2']]);
      expect(await pass(true, 3)).toEqual([['S1', 'S2', 'S3'], ['S4', 'S5'], []]);
    } finally {
      await engine.stop();
    }
  });
});
