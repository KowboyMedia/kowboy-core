// The web role exactly as deployed, `node dist/main.js web` in a function: the adapters' mappers
// are registered without the adapters started, so a recompute from stored raw works in the web
// process with no CRM traffic.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { main } from '../main.js';
import { adapterApi } from '../engine/adapter-api/index.js';
import { clearRegistry } from '../engine/registry.js';
import { recompute } from '../engine/recompute.js';
import { createJob, runNextJob, getJob } from '../engine/jobs.js';
import { createTenant, upsertConnection } from '../engine/storage/connections.js';
import type { Engine } from '../engine/index.js';
import { TOKEN, truncate } from './harness.js';

const CONNECTION = 'vitec-entrypoint';
const OFFICE = 'M77';

const estate = {
  id: 'OBJ-ENTRY',
  customerId: OFFICE,
  changedAt: '2026-09-10T08:00:00.1234567+02:00',
  status: { id: 1, name: 'Till salu' },
  address: { streetAddress: 'Storgatan 1', city: 'Malmö' },
  price: { startingPrice: 2000000, currency: 'SEK' },
};

let engine: Engine;
let server: Server;

beforeEach(async () => {
  clearRegistry();
  process.env['PORT'] = '0';
  const started = await main('web');
  engine = started.engine;
  server = started.server as Server;
  await truncate();
  await createTenant({ displayName: 'Entry tenant', token: TOKEN });
  await upsertConnection({
    id: CONNECTION,
    tenantId: 1,
    provider: 'vitec',
    licensedOffices: [OFFICE],
  });
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await engine.stop();
});

describe('the web process as deployed', () => {
  it('recomputes a stored record with no adapter started (AC 13)', async () => {
    // The record arrives the way the worker's adapter would write it: through the adapter API.
    const api = adapterApi('vitec');
    const written = await api.ingest(
      {
        id: CONNECTION,
        tenantId: 1,
        provider: 'vitec',
        credentials: null,
        licensedOffices: [OFFICE],
        active: true,
      },
      'property',
      estate.id,
      estate,
    );
    expect(written.outcome).toBe('written');

    const preview = await recompute({ connectionId: CONNECTION }, { dryRun: true });
    expect(preview.examined).toBe(1);
    expect(preview.failed).toBe(0);

    // The same as a job, run here as the worker would run it.
    const id = await createJob({
      kind: 'recompute',
      scope: { connectionId: CONNECTION },
      dryRun: true,
      requestedBy: 'test',
    });
    expect(await runNextJob()).toBe(true);
    const job = await getJob(id);
    expect(job?.state).toBe('done');
    expect((job?.result as { examined: number } | null)?.examined).toBe(1);
  });
});
