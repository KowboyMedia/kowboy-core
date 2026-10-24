// The smoke suite (AC 18) against a Core started here as a deploy starts its web role: every check
// passes on a version that answers as a whole, and a version that does not answer fails each
// check with a line saying which.
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { startEngine, type Engine } from './index.js';
import { smoke, smokeInWords, SUITES } from './smoke.js';
import { closeDb, db } from './storage/db.js';

let engine: Engine | null = null;

afterEach(async () => {
  await engine?.stop();
  engine = null;
  await closeDb();
});

describe('the smoke suite', () => {
  it('passes against a Core whose database, worker, admin app and sites’ API answer', async () => {
    engine = await startEngine({ port: 0 });
    const server = engine.listen();
    // The worker is not started here; its heartbeat stands in for it.
    await db().query(
      `insert into heartbeats (name, at) values ('worker', now())
       on conflict (name) do update set at = now()`,
    );
    const baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;

    const failures = await smoke(baseUrl, 1, 0);

    expect(failures).toEqual([]);
    expect(smokeInWords(baseUrl, failures)).toEqual([
      `Smoke suite: 4 checks against ${baseUrl}, all pass.`,
    ]);
  });

  it('as a start check, passes against a new version whose worker has not run yet', async () => {
    engine = await startEngine({ port: 0 });
    const server = engine.listen();
    await db().query(`delete from heartbeats where name = 'worker'`);
    const baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;

    const failures = await smoke(baseUrl, 1, 0, SUITES.start);

    expect(failures).toEqual([]);
    expect(smokeInWords(baseUrl, failures, SUITES.start)).toEqual([
      `Smoke suite: 3 checks against ${baseUrl}, all pass.`,
    ]);
    expect(await smoke(baseUrl, 1, 0)).toEqual([expect.stringMatching(/^\/v1\/health: /)]);
  });

  it('fails every check, with its address, when nothing answers', async () => {
    const baseUrl = 'http://127.0.0.1:9';

    const failures = await smoke(baseUrl, 2, 0);

    expect(failures.map((failure) => failure.split(':')[0])).toEqual([
      '/v1/ready',
      '/v1/health',
      '/admin',
      '/v1/changes',
    ]);
    expect(smokeInWords(baseUrl, failures)[0]).toBe(
      `Smoke suite: 4 of 4 checks against ${baseUrl} fail.`,
    );
  });
});
