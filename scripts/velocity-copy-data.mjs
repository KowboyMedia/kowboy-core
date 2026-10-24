// Copies Core's database from DigitalOcean to a Cloudways Velocity app's own (Patric, 2026-10-24:
// "Make sure data is migrated from do to cw"). A Velocity app's build runs it in the app's folder,
// after `npm install`, where the app's settings are in `.env`:
//
//   node scripts/velocity-copy-data.mjs
//
// Without MOVE_FROM_DATABASE_URL in the settings it does nothing, so a build can always run it.
// With it, every table but `migrations` is read from that database in one snapshot and written to
// the app's DATABASE_URL in one transaction: the copy lands whole or not at all, and only when
// every table's count matches. Sequences follow, so new records number on from the copied ones.
// MOVE_FROM_DATABASE_CA_CERT is the managed cluster's certificate, which the connection verifies.
//
// It refuses, and changes nothing, when
//   - the app's database lacks a migration the source has: the app runs an older version, so
//     deploy the newer first;
//   - the app's database holds records newer than the source's: the app has taken over, and a
//     copy would go back;
//   - the app's CREDENTIALS_KEY cannot read the copied logins and site tokens: it is not the
//     source's key, and the copy would be of no use.
import { createDecipheriv, createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import pg from 'pg';

if (existsSync('.env')) process.loadEnvFile('.env');
const from = process.env['MOVE_FROM_DATABASE_URL'] ?? '';
const to = process.env['DATABASE_URL'] ?? '';
if (!from) {
  console.log('No MOVE_FROM_DATABASE_URL: nothing to copy.');
  process.exit(0);
}
if (!to) throw new Error('DATABASE_URL must be set');

/** Every value as Postgres writes it, so a value is copied exactly, and cast back on the way in. */
const asText = { getTypeParser: () => (value) => value };

function connect(url, ca) {
  if (!ca) return new pg.Client({ connectionString: url });
  // The connection string's sslmode would replace the certificate given here.
  const address = new URL(url);
  address.searchParams.delete('sslmode');
  return new pg.Client({ connectionString: address.toString(), ssl: { ca } });
}

const quote = (name) => `"${name.replaceAll('"', '""')}"`;

/** Each table's columns, in order, with their types; generated columns are the database's own. */
async function tables(client) {
  const { rows } = await client.query(
    `select c.relname as table, a.attname as column, format_type(a.atttypid, a.atttypmod) as type,
            a.attgenerated <> '' as generated
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
     order by c.relname, a.attnum`,
  );
  const found = new Map();
  for (const row of rows) {
    if (!found.has(row.table)) found.set(row.table, []);
    found.get(row.table).push(row);
  }
  return found;
}

/** The tables in an order where each comes after the tables its foreign keys point at. */
async function inInsertOrder(client, names) {
  const { rows } = await client.query(
    `select child.relname as child, parent.relname as parent
     from pg_constraint k
     join pg_class child on child.oid = k.conrelid
     join pg_class parent on parent.oid = k.confrelid
     join pg_namespace n on n.oid = k.connamespace
     where k.contype = 'f' and n.nspname = 'public' and child.oid <> parent.oid`,
  );
  const ordered = [];
  const placing = new Set();
  const place = (name) => {
    if (ordered.includes(name)) return;
    if (placing.has(name)) throw new Error(`the foreign keys of ${name} go round in a circle`);
    placing.add(name);
    for (const { parent } of rows.filter((row) => row.child === name)) {
      if (names.includes(parent)) place(parent);
    }
    ordered.push(name);
  };
  for (const name of names) place(name);
  return ordered;
}

const migrations = async (client) =>
  (await client.query('select name from migrations order by name')).rows.map((row) => row.name);

const lastRecord = async (client, names) =>
  names.includes('items')
    ? Number((await client.query('select coalesce(max(seq), 0) as seq from items')).rows[0].seq)
    : 0;

/** A value sealed as engine/storage/crypto.ts seals it, opened with this app's key. */
function open(sealed, key) {
  const [iv, tag, text] = sealed.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(text), decipher.final()]).toString('utf8');
}

/** Whether this app's key reads a copied site token and a copied login; null with none to read. */
async function keyReads(client) {
  const key = Buffer.from(process.env['CREDENTIALS_KEY'] ?? '', 'base64');
  const tenant = (
    await client.query(
      'select token_enc, token_hmac from tenants where token_enc is not null limit 1',
    )
  ).rows[0];
  const login = (
    await client.query('select credentials from connections where credentials is not null limit 1')
  ).rows[0];
  if (!tenant && !login) return null;
  try {
    if (tenant) {
      const token = open(tenant.token_enc, key);
      if (createHmac('sha256', key).update(token).digest('hex') !== tenant.token_hmac) return false;
    }
    if (login) open(login.credentials, key);
    return true;
  } catch {
    return false;
  }
}

const count = async (client, name) =>
  Number((await client.query(`select count(*) as n from ${quote(name)}`)).rows[0].n);

const source = connect(from, process.env['MOVE_FROM_DATABASE_CA_CERT']);
const target = connect(to);
await source.connect();
await target.connect();
let failed = true;
try {
  await source.query('begin isolation level repeatable read read only');
  await target.query('begin');
  await target.query(`set local lock_timeout = '2min'`);

  const sourceTables = await tables(source);
  const targetTables = await tables(target);
  const names = [...sourceTables.keys()].filter((name) => name !== 'migrations');

  const applied = new Set(await migrations(target));
  const missing = (await migrations(source)).filter((name) => !applied.has(name));
  if (missing.length) {
    throw new Error(
      `This app's database lacks ${missing.join(', ')}, which the source has: deploy the newer version here first.`,
    );
  }
  for (const name of names) {
    const columns = new Set((targetTables.get(name) ?? []).map((column) => column.column));
    const absent = sourceTables.get(name).filter((column) => !columns.has(column.column));
    if (!targetTables.has(name) || absent.length) {
      throw new Error(`This app's database has no ${name} to copy into, or not all its columns.`);
    }
  }
  const sourceLast = await lastRecord(source, names);
  const targetLast = await lastRecord(target, names);
  if (targetLast > sourceLast) {
    throw new Error(
      `This app's database has records newer than the source's (${targetLast} against ${sourceLast}): it has taken over, and a copy would go back.`,
    );
  }

  const order = await inInsertOrder(source, names);
  await target.query(`truncate ${order.map(quote).join(', ')} cascade`);
  const report = [];
  for (const name of order) {
    const columns = sourceTables.get(name).filter((column) => !column.generated);
    const list = columns.map((column) => quote(column.column)).join(', ');
    const batch = Math.max(1, Math.min(500, Math.floor(30_000 / columns.length)));
    await source.query(`declare copying no scroll cursor for select ${list} from ${quote(name)}`);
    for (;;) {
      const { rows } = await source.query({
        text: `fetch ${batch} from copying`,
        rowMode: 'array',
        types: asText,
      });
      if (!rows.length) break;
      const values = [];
      const tuples = rows.map(
        (row) =>
          `(${row.map((value, i) => `$${values.push(value)}::${columns[i].type}`).join(', ')})`,
      );
      await target.query(
        `insert into ${quote(name)} (${list}) overriding system value values ${tuples.join(', ')}`,
        values,
      );
    }
    await source.query('close copying');
    const copied = await count(source, name);
    const landed = await count(target, name);
    if (copied !== landed) throw new Error(`${name}: ${copied} read but ${landed} written`);
    report.push(`${name} ${copied}`);
  }

  const sequences = `select sequencename as name, last_value from pg_sequences where schemaname = 'public'`;
  const targetSequences = new Set((await target.query(sequences)).rows.map((row) => row.name));
  for (const { name, last_value: last } of (await source.query(sequences)).rows) {
    if (!targetSequences.has(name)) continue;
    if (last === null) await target.query(`alter sequence ${quote(name)} restart`);
    else await target.query('select setval($1::regclass, $2::bigint, true)', [quote(name), last]);
  }

  const reads = await keyReads(target);
  if (reads === false) {
    throw new Error(
      "This app's CREDENTIALS_KEY cannot read the copied logins and site tokens: it is not the source's key.",
    );
  }

  await target.query('commit');
  failed = false;
  console.log(`Copied ${order.length} tables, every count matching: ${report.join(', ')}.`);
  console.log(
    reads ? "This app's key reads the copied logins and site tokens." : 'No logins to read yet.',
  );
} catch (error) {
  console.error(`Nothing copied. ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (failed) await target.query('rollback').catch(() => undefined);
  await source.query('rollback').catch(() => undefined);
  await source.end();
  await target.end();
}
