// The Core the browser journeys run against (admin/playwright.config.ts): the engine and the web
// role exactly as deployed, with the fake CRM adapter's endpoints mounted and a few records ready
// to load. It is an entrypoint of its own, like main.ts, and is never part of the shipped app: it
// runs from `dist` after `npm run build`, and only the journeys start it.
import type { AddressInfo } from 'node:net';
import { startEngine } from '../engine/index.js';
import { adapterApi, startAdapter } from '../engine/adapter-api/index.js';
import { adapterRoutes } from '../engine/http/server.js';
import { registerAdmin, registerSubmissions } from '../engine/registry.js';
import { db } from '../engine/storage/db.js';
import { deliverLifecycleEvents } from '../engine/lifecycle.js';
import { fakeWebhookAdapter } from '../adapters/fake-webhook/index.js';
import * as crm from '../adapters/fake-webhook/crm.js';

process.env['DATABASE_URL'] ??= 'postgres://core:core@127.0.0.1:5432/core';
process.env['CREDENTIALS_KEY'] ??= Buffer.alloc(32).toString('base64');
process.env['ADMIN_EMAILS'] = 'tester@kowboy.se';
process.env['BELL_THROTTLE_MS'] ??= '50';
// No mail sender, so the sign-in link comes back in the answer: the only way in on a machine
// with no Postmark token, and what the journey's sign-in page shows.
delete process.env['POSTMARK_SERVER_TOKEN'];
delete process.env['SENTRY_ENVIRONMENT'];

/** A few records to onboard against, enough for a grid, a record page and a recompute. */
function fillTheCrm(): void {
  crm.reset();
  crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
  for (const [index, street] of ['Storgatan 12', 'Kungsgatan 3', 'Hamnvägen 8'].entries()) {
    crm.put('property', `OBJ-${String(index + 1)}`, {
      ref: `OBJ-${String(index + 1)}`,
      state: 'FOR_SALE',
      streetAddress: street,
      askingPrice: 4_950_000 + index * 100_000,
      officeRef: '100',
      areaRefs: [],
      brokerRefs: [],
      associationRef: null,
      updatedUtc: '2026-09-08T10:02:00Z',
      internalCode: index + 1,
    });
  }
}

const port = Number(process.argv[2] ?? 4319);
process.env['PORT'] = String(port);

const engine = await startEngine({ port });
// A journey starts from nothing, so what a person sees is what these tests made.
await db().query(
  'truncate tenants, connections, subscribers, items, heartbeats, events, lifecycle_events, health_results, error_reports, jobs, alert_state, settings, admin_logins, admin_sessions restart identity cascade',
);
await db().query("select setval('item_seq', 1, false)");

// The fake CRM here takes an interest, so a form tried in the journeys goes as far as the guard:
// this Core is not the live service, so the form stops before any CRM call and is kept as
// refused, which is what "Failed forms" lists and sends again.
const takesForms = {
  ...fakeWebhookAdapter,
  manifest: { ...fakeWebhookAdapter.manifest, submissions: ['interest' as const] },
};
adapterApi(takesForms.manifest.provider).register(takesForms.manifest, takesForms.mappers);
registerSubmissions(takesForms.manifest.provider, {
  submit: () => Promise.resolve({ outcome: 'delivered' }),
});
if (fakeWebhookAdapter.admin) {
  registerAdmin(fakeWebhookAdapter.manifest.provider, fakeWebhookAdapter.admin);
}
fillTheCrm();
await startAdapter(takesForms);

// The worker's two ticks the journeys depend on: a save's lifecycle event reaches the adapter,
// and the health checks are recorded, so the Overview page has a verdict to show.
const tick = setInterval(() => void deliverLifecycleEvents(), 500);
tick.unref?.();
const beat = setInterval(
  () =>
    void db().query(`insert into heartbeats (name, at) values ('worker', now())
     on conflict (name) do update set at = now()`),
  5_000,
);
beat.unref?.();
void db().query(`insert into heartbeats (name, at) values ('worker', now())
   on conflict (name) do update set at = now()`);

const server = engine.listen(
  adapterRoutes(fakeWebhookAdapter.manifest.provider, fakeWebhookAdapter.routes ?? []),
);
console.log(`journey core on ${String((server.address() as AddressInfo).port)}`);

const stop = (): void => {
  clearInterval(tick);
  clearInterval(beat);
  void fakeWebhookAdapter.stop?.();
  void engine.stop().finally(() => process.exit(0));
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
