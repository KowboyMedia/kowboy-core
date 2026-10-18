// The worker's background tasks and the stop that ends them. Every deploy stops the worker, and
// on staging its tasks still ran after the stop had closed the database ("Cannot use a pool after
// calling end on the pool", from the bells, the alerts and the connections, 2026-10-06 to
// 2026-10-18): a stop now lets the running tasks finish first.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { truncate } from '../acceptance/harness.js';
import { startEngine } from './index.js';
import { addSubscriber, createTenant } from './storage/connections.js';
import { closeDb, db } from './storage/db.js';

let site: Server | null = null;

afterEach(async () => {
  await new Promise<void>((resolve) => (site ? site.close(() => resolve()) : resolve()));
  site = null;
  await closeDb();
});

/** A site that answers a bell after `ms`, so the bell is still on its way when Core stops. */
async function slowSite(ms: number): Promise<string> {
  site = createServer((_request, response) => {
    setTimeout(() => response.end('ok'), ms);
  });
  await new Promise<void>((resolve) => site!.listen(0, '127.0.0.1', () => resolve()));
  return `http://127.0.0.1:${String((site.address() as AddressInfo).port)}/bell`;
}

describe('the worker', () => {
  it('finishes the bell it is sending before a stop closes the database', async () => {
    const engine = await startEngine({ port: 0 });
    await truncate();
    const tenantId = await createTenant({ displayName: 'Stopping tenant', token: 'tok-stop' });
    const subscriber = await addSubscriber({
      tenantId,
      label: 'slow site',
      bellUrl: await slowSite(300),
      bellSecret: 'secret',
    });
    await db().query(`update subscribers set bell_pending = 'delta' where id = $1`, [subscriber]);

    // The worker takes the pending bell at once, and the stop comes while the site has not answered.
    engine.startWorker();
    await engine.stop();

    db(process.env['DATABASE_URL']);
    const { rows } = await db().query<{ last_bell_status: string | null }>(
      'select last_bell_status from subscribers where id = $1',
      [subscriber],
    );
    expect(rows[0]?.last_bell_status).toBe('ok');
  });
});
