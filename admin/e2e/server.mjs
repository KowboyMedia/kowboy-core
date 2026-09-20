// The Core the browser journeys run against: the built engine with the Vitec adapter and a fake
// Vitec Connect behind it, the worker's ticks running, mails kept and handed out through a
// test-only route. Started by Playwright (admin/playwright.config.ts) after `npm run build`.
import { harness } from '../../dist/acceptance/harness.js';
import { vitecAdapter } from '../../dist/adapters/vitec/index.js';
import { startFakeConnect } from '../../dist/adapters/vitec/test/connect.js';

process.env['DATABASE_URL'] ??= 'postgres://core:core@127.0.0.1:5432/core';
process.env['ADMIN_SECRET'] ??= 'test-admin-secret';
process.env['ADMIN_EMAIL_DOMAINS'] = 'example.test';
process.env['ADMIN_LOGIN_WITHOUT_EMAIL'] = 'false';
process.env['CREDENTIALS_KEY'] ??= Buffer.alloc(32).toString('base64');
process.env['BELL_THROTTLE_MS'] = '50';
process.env['VITEC_REQUESTS_PER_SECOND'] = '1000';
process.env['VITEC_WEBHOOK_TOKEN'] = 'journey-hook-token';
process.env['SENTRY_ENVIRONMENT'] = 'local';

const OFFICE = 'M1';
const fake = await startFakeConnect();
process.env['VITEC_BASE_URL'] = fake.url;

/** A few records of one office, in Vitec's shapes, for the journeys to load. */
const estate = (id, extra = {}) => ({
  id,
  customerId: OFFICE,
  changedAt: '2026-09-10T08:00:00.1234567+02:00',
  status: { id: 1, name: 'Till salu' },
  address: { streetAddress: `Storgatan ${id.slice(-1)}`, city: 'Malmö', area: 'Davidshall' },
  price: { startingPrice: 3495000, currency: 'SEK' },
  ...extra,
});
fake.put(OFFICE, 'office', {
  id: 'OFF1',
  customerId: OFFICE,
  name: 'Acme Malmö',
  changedAt: '2026-09-10T08:00:00+02:00',
});
fake.put(OFFICE, 'agent', {
  id: 'AG1',
  customerId: OFFICE,
  firstName: 'Anna',
  lastName: 'Andersson',
  changedAt: '2026-09-10T08:00:00+02:00',
});
for (const id of ['OBJ1', 'OBJ2', 'OBJ3']) fake.put(OFFICE, 'property', estate(id));

const running = await harness({
  adapters: [vitecAdapter],
  subscriber: false,
  port: Number(process.env['PORT'] ?? 3199),
  routes: [
    {
      method: 'GET',
      path: '/__e2e/mails',
      handler: async () => ({ status: 200, body: { mails: running.mails } }),
    },
    {
      method: 'POST',
      path: '/__e2e/site-failed',
      handler: async () => ({ status: 200, body: { ok: true } }),
    },
  ],
});
running.engine.startWorker();
console.log(`journey server on ${running.baseUrl} with fake Connect at ${fake.url}`);

const stop = async () => {
  await running.stop();
  await fake.close();
  process.exit(0);
};
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
