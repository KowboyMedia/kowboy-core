import pg from 'pg';

let pool: pg.Pool | null = null;

/** The one connection pool. Call `closeDb` on shutdown. */
export function db(databaseUrl?: string): pg.Pool {
  if (!pool) {
    if (!databaseUrl) throw new Error('the database pool is not open yet');
    pool = new pg.Pool({
      connectionString: databaseUrl,
      // Sized to the cluster (docs/decisions.md, 2026-10-06). The smallest managed plan lets the
      // apps open 22 connections (25 per GiB of RAM, 3 of them kept for the platform's own
      // maintenance), and staging and production share that one cluster. Six processes can be
      // connected at once: each app's web and worker, and during a deploy the new web and worker
      // of one app while its old ones still run. 22 / 6 leaves 3 a process: 2 here and 1 in an
      // adapter's own pool, 18 in all with 4 to spare. A query that finds the pool busy waits
      // its turn instead of failing with "remaining connection slots are reserved" (seen
      // 2026-09-20 with one app on the cluster, and 2026-10-06 with two).
      max: 2,
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
