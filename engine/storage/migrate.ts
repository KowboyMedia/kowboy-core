import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

const migrationFiles = (): string[] =>
  readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

async function appliedMigrations(): Promise<Set<string>> {
  const pool = db();
  await pool.query(
    'create table if not exists migrations (name text primary key, applied_at timestamptz not null default now())',
  );
  return new Set(
    (await pool.query<{ name: string }>('select name from migrations')).rows.map((r) => r.name),
  );
}

/**
 * Migrations the database has applied that this app does not ship: the app is older than the
 * database, which is safe only while every change was additive (strategy §6, §7.2).
 */
export async function unknownMigrations(): Promise<string[]> {
  const files = new Set(migrationFiles());
  return [...(await appliedMigrations())].filter((name) => !files.has(name)).sort();
}

/** Apply every migration that hasn't run yet, in filename order. Runs at startup. */
export async function migrate(): Promise<string[]> {
  const pool = db();
  const applied = await appliedMigrations();
  const files = migrationFiles();

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into migrations (name) values ($1)', [file]);
      await client.query('commit');
      ran.push(file);
    } catch (error) {
      await client.query('rollback');
      throw new Error(`migration ${file} failed: ${String(error)}`);
    } finally {
      client.release();
    }
  }
  return ran;
}
