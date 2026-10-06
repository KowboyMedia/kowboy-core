// Alerts: one message by mail or to a Slack incoming webhook or both, told once. Two things are
// told. A health check changing state: the last state per check is kept in the database, so a red
// check is told once, not every minute, and its recovery once, with a link to the health page. An
// event that needs attention (attention.ts): told the moment it is written, by the process that
// wrote it, with the tenant and a link to its page in the admin area.
import { healthReport } from './health.js';
import { db } from './storage/db.js';
import { listenToEvents, logEvent, type EventFields, type EventRow } from './events.js';
import { mailConfigured, sendMail } from './mail.js';
import { report } from './errors.js';
import { attention } from './attention.js';
import { summarise } from './admin/summary.js';

export type AlertConfig = {
  environment: string;
  publicUrl: string | null;
  email: string | null;
  slackWebhookUrl: string | null;
};

export type AlertChange = { name: string; ok: boolean; detail: string | null; names: string[] };

type StateRow = { name: string; ok: boolean };

/**
 * Compare the checks with the last state seen, keep the new state, write a `check.failed` or
 * `check.recovered` event per change, and tell every change in one message.
 */
export async function checkAlerts(config: AlertConfig): Promise<AlertChange[]> {
  const health = await healthReport();
  const { rows } = await db().query<StateRow>('select name, ok from alert_state');
  const last = new Map(rows.map((row) => [row.name, row.ok]));
  const changes: AlertChange[] = [];
  for (const [name, check] of Object.entries(health.checks)) {
    const before = last.get(name);
    // A check seen for the first time is told only when it is red: green is the expected state.
    if (before === check.ok || (before === undefined && check.ok)) {
      await db().query(
        `insert into alert_state (name, ok, detail) values ($1, $2, $3)
         on conflict (name) do update set detail = excluded.detail`,
        [name, check.ok, check.detail ?? null],
      );
      continue;
    }
    await db().query(
      `insert into alert_state (name, ok, detail, since, notified_at) values ($1, $2, $3, now(), now())
       on conflict (name) do update set ok = excluded.ok, detail = excluded.detail, since = now(), notified_at = now()`,
      [name, check.ok, check.detail ?? null],
    );
    const change = { name, ok: check.ok, detail: check.detail ?? null, names: check.names ?? [] };
    changes.push(change);
    await logEvent({
      type: change.ok ? 'check.recovered' : 'check.failed',
      fields: { name, detail: change.detail, names: change.names },
    });
  }
  if (changes.length > 0) await tellChanges(changes, config);
  return changes;
}

/** From now on, an event that needs attention is told as soon as it is written. */
export function watchEvents(config: AlertConfig): void {
  listenToEvents((event) => {
    tellEvent(event, config).catch((error: unknown) => report(error, { where: 'alert' }));
  });
}

/** The checks' message: every change of this minute in one, and a link to the health page. */
async function tellChanges(changes: AlertChange[], config: AlertConfig): Promise<void> {
  const red = changes.filter((change) => !change.ok);
  const subject = `Core ${config.environment}: ${red.length > 0 ? `${red.length} check(s) failing` : 'all checks green again'}`;
  // The names the public health answer leaves out belong here: the alert goes to Kowboy alone.
  // Each line is the sentence its event reads on the Events page, so one change says one thing.
  const lines = changes.map((change) =>
    summarise(change.ok ? 'check.recovered' : 'check.failed', {
      name: change.name,
      detail: change.detail,
      names: change.names,
    }),
  );
  await send(subject, lines, config.publicUrl ? `${config.publicUrl}/v1/health` : null, config, {
    changes: changes.map((change) => `${change.name}=${change.ok ? 'ok' : 'red'}`),
  });
}

/**
 * One event that needs attention, read back as the Overview lists it: the tenant and the
 * connection, the same sentence the Events page reads, and a link to the tenant's page. A kind told
 * with the checks went with the other changes of its minute above.
 */
async function tellEvent(event: EventRow, config: AlertConfig): Promise<void> {
  const [row] = await attention({ id: Number(event.id) });
  if (!row || row.kind.told !== 'on write') return;
  const names = [row.tenant, row.connectionId].filter((name) => name);
  const link = config.publicUrl
    ? `${config.publicUrl}/admin${row.tenantId === null ? '' : `/tenants/${String(row.tenantId)}`}`
    : null;
  await send(
    `Core ${config.environment}: ${row.kind.title}`,
    [`${names.length > 0 ? `${names.join(', ')}: ` : ''}${summarise(row.type, row.fields)}`],
    link,
    config,
    { event: row.id, type: row.type },
  );
}

/** The message, then where it goes; every send is one `alert.sent` event, delivered or not. */
async function send(
  subject: string,
  lines: string[],
  link: string | null,
  config: AlertConfig,
  fields: EventFields,
): Promise<void> {
  const text = `${lines.join('\n')}${link ? `\n\n${link}` : ''}`;
  const outcomes: Record<string, string> = {};
  if (config.email && mailConfigured()) {
    outcomes['email'] = await attempt(() => sendMail({ to: config.email ?? '', subject, text }));
  }
  if (config.slackWebhookUrl) {
    outcomes['slack'] = await attempt(async () => {
      const response = await fetch(config.slackWebhookUrl ?? '', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: `*${subject}*\n${text}` }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`slack answered ${response.status}`);
    });
  }
  await logEvent({
    type: 'alert.sent',
    fields: { subject, ...fields, outcomes, channels: Object.keys(outcomes).length },
  });
}

async function attempt(send: () => Promise<void>): Promise<string> {
  try {
    await send();
    return 'sent';
  } catch (error) {
    report(error, { where: 'alert' });
    return `failed: ${String(error)}`;
  }
}
