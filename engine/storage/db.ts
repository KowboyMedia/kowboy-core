import pg from 'pg';

/**
 * Connections per process. Writes are serialised by the write lock and reads are short, so five
 * are plenty; with an adapter's own pool of three, two processes fit the smallest managed cluster.
 */
const POOL_MAX = 5;

let pool: pg.Pool | null = null;

/**
 * How to open `url`. A managed cluster signs its certificate with its own CA, which the platform
 * hands over as `DATABASE_CA_CERT`; the server is then verified against that CA. The URL's own
 * `sslmode` is dropped, because `pg` lets it override an explicit `ssl` setting.
 */
export function connectionOptions(url: string, caCert: string | null): pg.PoolConfig {
  if (!caCert) return { connectionString: url };
  const parsed = new URL(url);
  parsed.searchParams.delete('sslmode');
  return { connectionString: parsed.toString(), ssl: { ca: caCert } };
}

/** The one connection pool. Call `closeDb` on shutdown. */
export function db(databaseUrl?: string, caCert: string | null = null): pg.Pool {
  if (!pool) {
    if (!databaseUrl) throw new Error('the database pool is not open yet');
    pool = new pg.Pool({ ...connectionOptions(databaseUrl, caCert), max: POOL_MAX });
    pool.on('error', (error) => console.error('idle database client error', error));
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
}

/** Run `body` inside one transaction. */
export async function transaction<T>(body: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query('begin');
    const result = await body(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * The write lock (strategy §5.2). Held for the rest of the transaction, so `seq` order is commit
 * order and a subscriber can never step past an item that is still invisible.
 */
export async function takeWriteLock(client: pg.PoolClient): Promise<void> {
  await client.query('select pg_advisory_xact_lock(4711)');
}
