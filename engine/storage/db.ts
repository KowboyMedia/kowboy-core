import pg from 'pg';

let pool: pg.Pool | null = null;

/** The one connection pool. Call `closeDb` on shutdown. */
export function db(databaseUrl?: string): pg.Pool {
  if (!pool) {
    if (!databaseUrl) throw new Error('the database pool is not open yet');
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      // A connection the network silently dropped (a firewall change, a failover) must not hang a
      // query for good: it fails after a minute, and the pool discards the client it ran on.
      query_timeout: 60_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });
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
  let failure: Error | undefined;
  try {
    await client.query('begin');
    const result = await body(client);
    await client.query('commit');
    return result;
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    // Released with its error, a client that failed is discarded instead of handed out again.
    client.release(failure);
  }
}

/**
 * The write lock (strategy §5.2). Held for the rest of the transaction, so `seq` order is commit
 * order and a subscriber can never step past an item that is still invisible.
 */
export async function takeWriteLock(client: pg.PoolClient): Promise<void> {
  await client.query('select pg_advisory_xact_lock(4711)');
}
