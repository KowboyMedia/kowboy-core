// Recompute (and the adapters' record previews) run in the web process, which serves the admin
// panel. They re-run the adapter's mapper over stored raw, so the process must have the adapter's
// mappers registered. This pins that requirement: with no mappers registered a recompute reports
// "no adapter registered", and with them registered it succeeds. main.ts registers them in the
// web role for exactly this reason.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, type Harness } from './harness.js';
import { adapterApi } from '../engine/adapter-api/index.js';
import { clearRegistry } from '../engine/registry.js';
import { connectionById } from '../engine/storage/connections.js';
import { ingest } from '../engine/ingest.js';
import { recompute } from '../engine/recompute.js';
import { fakeWebhookAdapter } from '../adapters/fake-webhook/index.js';

const CONNECTION = 'fake-acme';
const raw = {
  ref: 'OBJ-1',
  state: 'FOR_SALE',
  streetAddress: 'Storgatan 12',
  askingPrice: 4950000,
  officeRef: '100',
  areaRefs: [],
  brokerRefs: [],
  associationRef: null,
  updatedUtc: '2026-09-08T10:02:00Z',
  internalCode: 1,
};

let running: Harness;

beforeEach(async () => {
  running = await harness({ adapters: [], connections: [{ id: CONNECTION, provider: 'fake-webhook' }] });
});
afterEach(async () => {
  await running.stop();
});

describe('recompute needs the adapter registered in the process', () => {
  it('fails with a clear message when no mapper is registered, and works once it is', async () => {
    // Register the mapper only long enough to store one item as ingest would.
    adapterApi('fake-webhook').register(fakeWebhookAdapter.manifest, fakeWebhookAdapter.mappers);
    const connection = await connectionById(CONNECTION);
    expect(connection).not.toBeNull();
    await ingest(connection!, 'property', 'OBJ-1', raw);

    // The web process before the fix: routes are up, but no adapter was started, so the registry
    // is empty.
    clearRegistry();
    const withoutMapper = await recompute({ connectionId: CONNECTION, datatype: 'property', remoteId: 'OBJ-1' });
    expect(withoutMapper.examined).toBe(1);
    expect(withoutMapper.failed).toBe(1);
    expect(withoutMapper.failures[0]?.errors[0]).toContain('no adapter registered');

    // The web process after the fix: main.ts registers every adapter's mappers.
    adapterApi('fake-webhook').register(fakeWebhookAdapter.manifest, fakeWebhookAdapter.mappers);
    const withMapper = await recompute({ connectionId: CONNECTION, datatype: 'property', remoteId: 'OBJ-1' });
    expect(withMapper.examined).toBe(1);
    expect(withMapper.failed).toBe(0);
  });
});
