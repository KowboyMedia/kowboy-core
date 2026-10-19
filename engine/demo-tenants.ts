// One-off on staging (Patric, 2026-10-19: "Rename norban by adding " - demo" suffix, same with
// ahre. Make sure both have form test mode enabled." and "Can you add the tokens in ahre demo wp, I
// don't have access to it"). The worker runs it at start on staging only; it comes out in the
// first commit after the staging worker's log shows it ran.
import { createHmac } from 'node:crypto';
import { db } from './storage/db.js';
import { setFormsTestMode } from './panel/connections.js';
import { tenantForToken, updateSubscriber, updateTenant } from './storage/connections.js';

/** Each demo: a word in the tenant's name, or a part of its demo website's address. */
const DEMOS = [
  { word: 'norban', site: 'wordpress-1545003-6698706' },
  { word: 'ahre', site: 'wordpress-1545003-6715283' },
];

const SUFFIX = ' - demo';
const NORBAN_DEMO = '%wordpress-1545003-6698706%';
const AHRE_DEMO = '%wordpress-1545003-6715283%';
const BELL_PATH = '/wp-json/core/v1/bell';
const MONTH_MS = 30 * 86_400_000;

/** Rename each demo tenant with " - demo" and turn on forms test mode on its connections. */
export async function markDemoTenants(): Promise<string[]> {
  const said: string[] = [];
  for (const { word, site } of DEMOS) {
    const { rows } = await db().query<{ id: number; display_name: string }>(
      `select distinct t.id, t.display_name from tenants t
         left join subscribers s on s.tenant_id = t.id
        where t.display_name ilike $1 or s.label like $2 or s.bell_url like $2
        order by t.id`,
      [`%${word}%`, `%${site}%`],
    );
    const named = rows.map((row) => `“${row.display_name}”`).join(', ');
    if (rows.length !== 1) {
      said.push(`${word}: ${String(rows.length)} tenants match (${named}), nothing changed`);
      continue;
    }
    const tenant = rows[0] as { id: number; display_name: string };
    let name = tenant.display_name;
    if (!name.endsWith(SUFFIX)) {
      name = `${name}${SUFFIX}`;
      await db().query('update tenants set display_name = $2 where id = $1', [tenant.id, name]);
    }
    const { rows: connections } = await db().query<{ id: string }>(
      'select id from connections where tenant_id = $1 order by id',
      [tenant.id],
    );
    for (const { id } of connections) await setFormsTestMode(id, true);
    said.push(
      `${word}: “${tenant.display_name}” is now “${name}”, forms test mode on for ${String(connections.length)} connection(s); it holds ${await holdings(Number(tenant.id))}`,
    );
  }
  said.push(await pairAhreDemo());
  return said;
}

/** When anything last fetched with the tenant's token: a pull marks each of its websites. */
async function lastPull(tenantId: number): Promise<Date | null> {
  const { rows } = await db().query<{ last: Date | null }>(
    'select max(last_pull_at) as last from subscribers where tenant_id = $1',
    [tenantId],
  );
  return rows[0]?.last ?? null;
}

async function holdings(tenantId: number): Promise<string> {
  const { rows } = await db().query<{ datatype: string; n: string }>(
    `select datatype, count(*) as n from items where tenant_id = $1 and not deleted
      group by datatype order by datatype`,
    [tenantId],
  );
  return rows.map((row) => `${row.n} ${row.datatype}`).join(', ') || 'no records';
}

/**
 * A value made from the Norban demo website's bell secret, which Core holds and the session that
 * writes the Ahre demo's plugin settings reads from the Norban demo's own settings: both ends make
 * the same token and bell secret, and neither is shown or logged. Both demos share one WordPress
 * login, so this widens no one's reach.
 */
const derive = (secret: string, what: string): string =>
  createHmac('sha256', secret).update(`ahre demo ${what}`).digest('base64url');

/**
 * The Ahre demo website's tenant gets the derived token and the website the derived bell secret,
 * unless something used the tenant's token in the last 30 days. Running it again changes nothing.
 */
async function pairAhreDemo(): Promise<string> {
  const { rows: norban } = await db().query<{ bell_secret: string }>(
    'select bell_secret from subscribers where bell_url like $1',
    [NORBAN_DEMO],
  );
  const { rows: ahre } = await db().query<{ id: string; tenant_id: string; bell_url: string }>(
    'select id, tenant_id, bell_url from subscribers where bell_url like $1',
    [AHRE_DEMO],
  );
  const secret = norban[0]?.bell_secret;
  const site = ahre[0];
  if (norban.length !== 1 || ahre.length !== 1 || !secret || !site) {
    return `ahre pairing: ${String(norban.length)} Norban demo and ${String(ahre.length)} Ahre demo websites, nothing changed`;
  }
  const tenantId = Number(site.tenant_id);
  const bellUrl = `${new URL(site.bell_url).origin}${BELL_PATH}`;
  if (site.bell_url !== bellUrl) await updateSubscriber(Number(site.id), { bellUrl });
  const token = derive(secret, 'token');
  if ((await tenantForToken(token))?.id === tenantId) {
    return `ahre pairing: already paired, bell address ${bellUrl}`;
  }
  const last = await lastPull(tenantId);
  if (last && Date.now() - last.getTime() < MONTH_MS) {
    return `ahre pairing: tenant ${String(tenantId)}'s token was used at ${last.toISOString()}, nothing changed`;
  }
  await updateTenant(tenantId, { token });
  await db().query('update tenants set token_replaced_at = now() where id = $1', [tenantId]);
  await updateSubscriber(Number(site.id), { bellSecret: derive(secret, 'bell secret') });
  return `ahre pairing: tenant ${String(tenantId)}'s token and the Ahre demo website's bell secret replaced, bell address ${bellUrl}`;
}
