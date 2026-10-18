// A site Core cannot reach is that site's state, shown on its row and in the alerts, not a fault in
// Core. On staging a site saved with an address that does not exist went to the error tracker as
// Core's error (2026-10-18): a failed bell is now recorded and logged, and nothing is reported.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { truncate } from '../acceptance/harness.js';
import { flushPendingBells } from './bells.js';
import { startEngine } from './index.js';
import { addSubscriber, createTenant } from './storage/connections.js';
import { closeDb, db } from './storage/db.js';

/** An address on this machine where nothing listens any more, so a connection is refused at once. */
async function closedAddress(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${String(port)}/bell`;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await closeDb();
});

describe('a bell', () => {
  it('to a site Core cannot reach is recorded as failed and not reported as an error', async () => {
    await startEngine({ port: 0 });
    await truncate();
    const tenantId = await createTenant({ displayName: 'Unreachable tenant', token: 'tok-gone' });
    const subscriber = await addSubscriber({
      tenantId,
      label: 'gone site',
      bellUrl: await closedAddress(),
      bellSecret: 'secret',
    });
    await db().query(`update subscribers set bell_pending = 'delta' where id = $1`, [subscriber]);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await flushPendingBells();

    const { rows } = await db().query<{ last_bell_status: string | null }>(
      'select last_bell_status from subscribers where id = $1',
      [subscriber],
    );
    expect(rows[0]?.last_bell_status).toBe('failed');
    expect(errors).not.toHaveBeenCalled();
    expect(warnings.mock.calls.some((call) => String(call[0]).includes('ECONNREFUSED'))).toBe(true);
  });
});
