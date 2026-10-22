// A site Core cannot reach is that site's state, shown on its row and in the alerts, not a fault in
// Core. On staging a site saved with an address that does not exist went to the error tracker as
// Core's error (2026-10-18): a failed bell is now recorded and logged, and nothing is reported.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { truncate } from '../acceptance/harness.js';
import { answerText, flushPendingBells } from './bells.js';
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

    const { rows } = await db().query<{
      last_bell_status: string | null;
      last_bell_answer: string | null;
    }>('select last_bell_status, last_bell_answer from subscribers where id = $1', [subscriber]);
    expect(rows[0]?.last_bell_status).toBe('failed');
    // Why it did not answer, kept for the Inbox's card.
    expect(rows[0]?.last_bell_answer).toContain('ECONNREFUSED');
    expect(errors).not.toHaveBeenCalled();
    expect(warnings.mock.calls.some((call) => String(call[0]).includes('ECONNREFUSED'))).toBe(true);
  });

  it('keeps what a website answered, the first 300 characters, an HTML page by its words', async () => {
    await startEngine({ port: 0 });
    await truncate();
    const page = `<!DOCTYPE html><html><head><title>Error</title><style>p { color: red }</style></head>
      <body><h1>There has been a critical error</h1><p>Learn more about debugging &amp; logs.</p></body></html>`;
    const server = createServer((_request, response) => {
      response.writeHead(500, { 'content-type': 'text/html; charset=UTF-8' });
      response.end(page);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    const tenantId = await createTenant({ displayName: 'Broken tenant', token: 'tok-broken' });
    const subscriber = await addSubscriber({
      tenantId,
      label: 'broken site',
      bellUrl: `http://127.0.0.1:${String(port)}/bell`,
      bellSecret: 'secret',
    });
    await db().query(`update subscribers set bell_pending = 'delta' where id = $1`, [subscriber]);

    await flushPendingBells();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    const { rows } = await db().query<{ last_bell_status: string; last_bell_answer: string }>(
      'select last_bell_status, last_bell_answer from subscribers where id = $1',
      [subscriber],
    );
    expect(rows[0]).toEqual({
      last_bell_status: 'http 500',
      last_bell_answer: 'Error There has been a critical error Learn more about debugging & logs.',
    });
  });
});

describe('a website’s answer, as Core keeps it', () => {
  it('is one line of at most 300 characters, and nothing when the website said nothing', () => {
    expect(answerText('{"code":"rest_forbidden",\n  "message":"Nope"}', false)).toBe(
      '{"code":"rest_forbidden", "message":"Nope"}',
    );
    expect(answerText('x'.repeat(400), false)).toHaveLength(300);
    expect(answerText(' \n ', false)).toBeNull();
    expect(answerText('<html><body></body></html>', true)).toBeNull();
  });
});
