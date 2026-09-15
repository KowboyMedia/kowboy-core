import { db } from './storage/db.js';
import { logEvent } from './events.js';
import { report } from './errors.js';

/**
 * Bells tell a subscriber "there is something new, pull". They carry no data (SRS §8).
 * Throttled per subscriber (strategy §5.2): the first change after a quiet period rings at once,
 * further changes inside the window collapse into one bell.
 */
export type BellKind = 'delta' | 'forcerefresh';

type Subscriber = {
  id: string;
  tenant_id: string;
  bell_url: string;
  bell_secret: string;
};

type Pending = { timer: NodeJS.Timeout; kind: BellKind };

let throttleMs = 10_000;
const lastRung = new Map<string, number>();
const pending = new Map<string, Pending>();

export function configureBells(windowMs: number): void {
  throttleMs = windowMs;
}

/** Ring every active subscriber of a tenant. Returns once immediate bells have been sent. */
export async function ring(tenantId: string, kind: BellKind = 'delta'): Promise<void> {
  const { rows } = await db().query<Subscriber>(
    'select id, tenant_id, bell_url, bell_secret from subscribers where tenant_id = $1 and active = true',
    [tenantId],
  );
  await Promise.all(rows.map((subscriber) => ringOne(subscriber, kind)));
}

async function ringOne(subscriber: Subscriber, kind: BellKind): Promise<void> {
  const key = subscriber.id;
  const since = Date.now() - (lastRung.get(key) ?? 0);

  if (since >= throttleMs) {
    lastRung.set(key, Date.now());
    await send(subscriber, kind);
    return;
  }

  // Inside the window: collapse into one trailing bell. forcerefresh outranks delta.
  const existing = pending.get(key);
  if (existing) {
    if (kind === 'forcerefresh') existing.kind = 'forcerefresh';
    return;
  }
  const timer = setTimeout(() => {
    const queued = pending.get(key);
    pending.delete(key);
    lastRung.set(key, Date.now());
    if (queued) void send(subscriber, queued.kind);
  }, throttleMs - since);
  timer.unref?.();
  pending.set(key, { timer, kind });
}

async function send(subscriber: Subscriber, kind: BellKind): Promise<void> {
  const startedAt = Date.now();
  try {
    const response = await fetch(subscriber.bell_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-core-secret': subscriber.bell_secret },
      body: JSON.stringify({ kind, tenant_id: subscriber.tenant_id }),
      signal: AbortSignal.timeout(10_000),
    });
    await record(subscriber, kind, response.ok ? 'ok' : `http ${response.status}`, startedAt);
  } catch (error) {
    report(error, { where: 'bell', subscriber: subscriber.id });
    await record(subscriber, kind, 'failed', startedAt);
  }
}

async function record(
  subscriber: Subscriber,
  kind: BellKind,
  status: string,
  startedAt: number,
): Promise<void> {
  await db().query(
    'update subscribers set last_bell_at = now(), last_bell_status = $2 where id = $1',
    [subscriber.id, status],
  );
  await logEvent({
    type: 'bell',
    tenantId: subscriber.tenant_id,
    subscriberId: Number(subscriber.id),
    fields: { kind, status, duration_ms: Date.now() - startedAt },
  });
}

/** Wait for queued trailing bells. Tests and shutdown use it; nothing else needs to. */
export async function flushBells(): Promise<void> {
  while (pending.size > 0) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export function stopBells(): void {
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
  lastRung.clear();
}
