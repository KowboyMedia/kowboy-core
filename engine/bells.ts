import { db } from './storage/db.js';
import { logEvent } from './events.js';
import { report } from './errors.js';
import { inMaintenance } from './storage/settings.js';

/**
 * Bells tell a subscriber "there is something new, pull". They carry no data (SRS §8).
 * Throttled per subscriber (strategy §5.2): the first change after a quiet period rings at once,
 * further changes inside the window collapse into one trailing bell.
 *
 * The throttle state is the subscriber row itself (`last_bell_at`, `bell_pending`), so any number
 * of web and worker processes agree on it. The worker flushes trailing bells once a second.
 */
export type BellKind = 'delta' | 'forcerefresh';

type Subscriber = {
  id: string;
  tenant_id: number;
  bell_url: string;
  bell_secret: string;
};

let throttleMs = 10_000;

export function configureBells(windowMs: number): void {
  throttleMs = windowMs;
}

const window = (): string => `${throttleMs} milliseconds`;

/** A site is rung only while its tenant's licence is active (Patric, 2026-09-18): otherwise it keeps what it shows. */
const LICENSED = 'exists (select 1 from tenants where id = subscribers.tenant_id and active)';

/**
 * While Core is in maintenance nothing is rung: the changes are remembered as pending bells and
 * go out in one round when the switch is turned off (docs/admin-panel.md, Settings).
 */
async function holdForMaintenance(tenantId: number, kind: BellKind): Promise<void> {
  await db().query(
    `update subscribers
     set bell_pending = case when bell_pending = 'forcerefresh' then bell_pending else $2 end
     where tenant_id = $1 and active = true and ${LICENSED}`,
    [tenantId, kind],
  );
}

/** Ring every active subscriber of a tenant: at once if outside the window, otherwise queued. */
export async function ring(tenantId: number, kind: BellKind = 'delta'): Promise<void> {
  if (await inMaintenance()) return holdForMaintenance(tenantId, kind);
  // The update is the claim: only one process wins the leading edge for a subscriber.
  const { rows: due } = await db().query<Subscriber>(
    `update subscribers set last_bell_at = now()
     where tenant_id = $1 and active = true and ${LICENSED}
       and (last_bell_at is null or last_bell_at < now() - $2::interval)
     returning id, tenant_id, bell_url, bell_secret`,
    [tenantId, window()],
  );
  // Everyone else is inside the window: collapse into one trailing bell. forcerefresh outranks delta.
  await db().query(
    `update subscribers
     set bell_pending = case when bell_pending = 'forcerefresh' then bell_pending else $2 end
     where tenant_id = $1 and active = true and ${LICENSED} and last_bell_at >= now() - $3::interval
       and id <> all($4::bigint[])`,
    [tenantId, kind, window(), due.map((row) => row.id)],
  );
  await Promise.all(due.map((subscriber) => send(subscriber, kind)));
}

/** Send the trailing bells whose window has passed. The worker calls this once a second. */
export async function flushPendingBells(): Promise<void> {
  if (await inMaintenance()) return;
  const { rows } = await db().query<Subscriber & { kind: BellKind }>(
    `update subscribers set last_bell_at = now(), bell_pending = null
     where bell_pending is not null and active = true and ${LICENSED}
       and (last_bell_at is null or last_bell_at < now() - $1::interval)
     returning id, tenant_id, bell_url, bell_secret, bell_pending as kind`,
    [window()],
  );
  await Promise.all(rows.map((row) => send(row, row.kind)));
}

async function send(subscriber: Subscriber, kind: BellKind): Promise<void> {
  const startedAt = Date.now();
  let status: string;
  try {
    const response = await fetch(subscriber.bell_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-core-secret': subscriber.bell_secret },
      body: JSON.stringify({ kind, tenant_id: subscriber.tenant_id }),
      signal: AbortSignal.timeout(10_000),
    });
    status = response.ok ? 'ok' : `http ${response.status}`;
  } catch (error) {
    report(error, { where: 'bell', subscriber: subscriber.id });
    status = 'failed';
  }
  await db().query('update subscribers set last_bell_status = $2 where id = $1', [
    subscriber.id,
    status,
  ]);
  await logEvent({
    type: 'bell',
    tenantId: subscriber.tenant_id,
    subscriberId: Number(subscriber.id),
    fields: { kind, status, duration_ms: Date.now() - startedAt },
  });
}

/** Test helper: let the window pass, then send whatever is queued. */
export async function flushBells(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, throttleMs + 5));
  await flushPendingBells();
}
