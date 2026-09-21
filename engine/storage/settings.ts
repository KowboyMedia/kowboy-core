import { db } from './db.js';

/**
 * Switches a person throws from the panel's Settings page (migration 008). One row per key, read
 * by whichever process needs it, so web and worker agree without a restart.
 */
export type SettingRow = {
  key: string;
  value: string;
  updated_at: Date;
  updated_by: string | null;
};

/** Maintenance: while it is on, the worker rings no site and takes no job (docs/admin-panel.md). */
export const MAINTENANCE = 'maintenance';

export async function readSetting(key: string): Promise<string | null> {
  const { rows } = await db().query<{ value: string }>(
    'select value from settings where key = $1',
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function writeSetting(key: string, value: string, by: string | null): Promise<void> {
  await db().query(
    `insert into settings (key, value, updated_by) values ($1, $2, $3)
     on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
    [key, value, by],
  );
}

export async function settings(): Promise<SettingRow[]> {
  const { rows } = await db().query<SettingRow>('select * from settings order by key');
  return rows;
}

/** True while Core is in maintenance. Read on every tick that would ring or run. */
export const inMaintenance = async (): Promise<boolean> =>
  (await readSetting(MAINTENANCE)) === 'on';
