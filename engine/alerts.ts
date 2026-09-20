// Alerts (docs/admin-panel.md): when a health check changes state, one message goes out, by mail
// or to a Slack incoming webhook or both, with a link to the panel. The last state per check is
// kept in the database, so a red check is told once, not every minute, and its recovery once.
import { healthReport } from './health.js';
import { db } from './storage/db.js';
import { logEvent } from './events.js';
import { mailConfigured, sendMail } from './mail.js';
import { report } from './errors.js';

export type AlertConfig = {
  environment: string;
  publicUrl: string | null;
  email: string | null;
  slackWebhookUrl: string | null;
};

export type AlertChange = { name: string; ok: boolean; detail: string | null };

type StateRow = { name: string; ok: boolean };

/** Compare the checks with the last state seen, keep the new state, and tell every change. */
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
    changes.push({ name, ok: check.ok, detail: check.detail ?? null });
  }
  if (changes.length > 0) await notify(changes, config);
  return changes;
}

/** The message, then where it goes; every send is one event, delivered or not. */
async function notify(changes: AlertChange[], config: AlertConfig): Promise<void> {
  const red = changes.filter((change) => !change.ok);
  const subject = `Core ${config.environment}: ${red.length > 0 ? `${red.length} check(s) failing` : 'all checks green again'}`;
  const lines = changes.map(
    (change) =>
      `${change.ok ? 'OK ' : 'RED'} ${change.name}${change.detail ? `: ${change.detail}` : ''}`,
  );
  const link = config.publicUrl ? `${config.publicUrl}/admin` : null;
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
    fields: {
      subject,
      changes: changes.map((change) => `${change.name}=${change.ok ? 'ok' : 'red'}`),
      outcomes,
      channels: Object.keys(outcomes).length,
    },
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
