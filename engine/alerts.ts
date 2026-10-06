// Alerts: one message by mail or to a Slack incoming webhook or both, told once. Two things are
// told. A health check changing state: the last state per check is kept in the database, so a red
// check is told once, not every minute, and its recovery once, with a link to the health page. An
// event that needs attention (attention.ts): told the moment it is written, by the process that
// wrote it, with the tenant and a link to its page in the admin area.
import { healthReport, SITES_CHECK, staleSites } from './health.js';
import type { HealthResult } from './adapter-api/types.js';
import { db } from './storage/db.js';
import { listenToEvents, logEvent, type EventFields, type EventRow } from './events.js';
import { mailConfigured, sendMail } from './mail.js';
import { report } from './errors.js';
import { kindOf, placesOf, type Place } from './attention.js';
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
  const places: Place[] = [];
  for (const [name, check] of Object.entries(health.checks)) {
    const change = await keep(name, check, last.get(name));
    if (!change) continue;
    changes.push(change);
    // The sites by number and tenant too, so the Overview and the alert can link to each one.
    const sites = name === SITES_CHECK && !check.ok ? { sites: await staleSites() } : {};
    const event = {
      type: change.ok ? 'check.recovered' : 'check.failed',
      fields: { name, detail: change.detail, names: change.names, ...sites },
    };
    await logEvent(event);
    places.push(...(await placesOf({ ...event, tenant_id: null, connection_id: null })));
  }
  if (changes.length > 0) await tellChanges(changes, places, config);
  return changes;
}

/** Keep a check's state, and say whether it changed in a way that is told. */
async function keep(
  name: string,
  check: HealthResult,
  before: boolean | undefined,
): Promise<AlertChange | null> {
  // A check seen for the first time is told only when it is red: green is the expected state.
  if (before === check.ok || (before === undefined && check.ok)) {
    await db().query(
      `insert into alert_state (name, ok, detail) values ($1, $2, $3)
       on conflict (name) do update set detail = excluded.detail`,
      [name, check.ok, check.detail ?? null],
    );
    return null;
  }
  await db().query(
    `insert into alert_state (name, ok, detail, since, notified_at) values ($1, $2, $3, now(), now())
     on conflict (name) do update set ok = excluded.ok, detail = excluded.detail, since = now(), notified_at = now()`,
    [name, check.ok, check.detail ?? null],
  );
  return { name, ok: check.ok, detail: check.detail ?? null, names: check.names ?? [] };
}

/** From now on, an event that needs attention is told as soon as it is written. */
export function watchEvents(config: AlertConfig): void {
  listenToEvents((event) => {
    tellEvent(event, config).catch((error: unknown) => report(error, { where: 'alert' }));
  });
}

/**
 * The checks' message: every change of this minute in one, then each thing a red check names with
 * its place in the admin area (a site that stopped pulling), and a link to the health page.
 */
async function tellChanges(
  changes: AlertChange[],
  places: Place[],
  config: AlertConfig,
): Promise<void> {
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
  await send(
    subject,
    [...lines, ...places.map((place) => `${which(place)}: ${opened(place, config)}`)],
    config.publicUrl ? `${config.publicUrl}/v1/health` : null,
    config,
    { changes: changes.map((change) => `${change.name}=${change.ok ? 'ok' : 'red'}`) },
  );
}

/** The thing, and where it is: "office Lidingö (M30011), tenant Acme Mäklare, connection acme-crm". */
const which = (place: Place): string =>
  [
    place.what,
    place.tenant && `tenant ${place.tenant}`,
    place.connectionId && `connection ${place.connectionId}`,
  ]
    .filter((part) => part)
    .join(', ');

/** The thing's place in the admin area, as a whole address when Core knows its own. */
const opened = (place: Place, config: AlertConfig): string =>
  config.publicUrl ? `${config.publicUrl}/admin${place.link}` : `the admin area, ${place.link}`;

/**
 * One event that needs attention, as the Overview lists it: which thing, where it is, what
 * happened in the sentence the Events page reads, and the link to it (question 163). A kind told
 * with the checks went with the other changes of its minute above.
 */
async function tellEvent(event: EventRow, config: AlertConfig): Promise<void> {
  const kind = kindOf(event.type, event.fields);
  if (kind?.told !== 'on write') return;
  for (const place of await placesOf(event)) {
    await send(
      `Core ${config.environment}: ${kind.title}`,
      [
        `Which: ${which(place)}`,
        `What happened: ${summarise(event.type, event.fields)}`,
        `Open it: ${opened(place, config)}`,
      ],
      null,
      config,
      { event: Number(event.id), type: event.type },
    );
  }
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
