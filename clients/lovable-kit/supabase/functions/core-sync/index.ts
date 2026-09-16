// The Lovable kit's one function: Core's bell lands here, and the sync it starts is the subscriber
// contract (SRS §8) written against this site's Supabase database.
//
//   POST /    header X-Core-Secret, body {"kind": "delta" | "forcerefresh"}
//             → 202 at once; the sync runs on after the response
//
// All state is in Postgres (core_sync_state), so any number of function instances agree: an
// advisory lock makes syncs run one at a time, and a bell arriving mid-run leaves a note
// ("pending") that the running sync works through before it lets go of the lock.
//
// Supabase stops an invocation after a few minutes, so one works for at most BUDGET_MS and then
// calls the function again to carry on (chain): one bell, however many invocations the sync takes.
import postgres from 'postgres';

const VERSION = '0.1.0';

/** How long one invocation works before handing over. Well under Supabase's wall-clock limit. */
const BUDGET_MS = Number(Deno.env.get('CORE_SYNC_BUDGET_MS') ?? 60_000);

/** Reference order (SRS §6.9): offices and agents before the properties that point at them. */
const DATATYPES = ['office', 'agent', 'area', 'association', 'property'] as const;
type Datatype = (typeof DATATYPES)[number];

const TABLE: Record<Datatype, string> = {
  office: 'offices',
  agent: 'agents',
  area: 'areas',
  association: 'associations',
  property: 'properties',
};

type Kind = 'delta' | 'forcerefresh';

/** How a run ended: everything pulled, or the budget spent with more to do. */
type Outcome = 'done' | 'out_of_time';

/** One sync at a time per site. The key is arbitrary; every instance uses the same one. */
const LOCK_KEY = 20260915;

type Item = {
  connection_id: string;
  remote_id: string;
  office_id: string | null;
  seq: number;
  deleted: boolean;
  content_hash: string;
  remote_updated_at: string | null;
  data: postgres.JSONValue | null;
};

type Page = { items: Item[]; next_after: number; has_more: boolean };

type Sql = ReturnType<typeof postgres>;

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

/** Error reporting placeholder, the same shape as Core's: JSON on stderr until a Sentry DSN exists. */
function report(message: string, context: Record<string, unknown> = {}): void {
  console.error(JSON.stringify({ level: 'error', source: 'core-sync', message, ...context }));
}

Deno.serve({ port: Number(Deno.env.get('PORT') ?? 8000) }, async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'POST a bell' }, { status: 405 });

  const given = request.headers.get('x-core-secret') ?? '';
  if (!(await sameSecret(given, env('CORE_BELL_SECRET')))) {
    return Response.json({ error: 'bad secret' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { kind?: unknown };
  const kind: Kind = body.kind === 'forcerefresh' ? 'forcerefresh' : 'delta';

  // Answer before the work: Core waits at most 10 s for a bell and never retries one.
  background(sync(kind));
  return Response.json({ queued: true }, { status: 202 });
});

/** Compare two secrets through their digests, so the comparison's timing says nothing about them. */
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const digest = async (value: string): Promise<Uint8Array> =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  return a.every((byte, index) => byte === b[index]);
}

/**
 * Keep working after the response is sent. Supabase's runtime needs `EdgeRuntime.waitUntil` for
 * that; plain Deno keeps a running promise alive by itself.
 */
function background(task: Promise<void>): void {
  const guarded = task.catch((error: unknown) => report('sync failed', { detail: String(error) }));
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(task: Promise<unknown>): void } })
    .EdgeRuntime;
  runtime?.waitUntil(guarded);
}

/**
 * Leave the note, take the lock, work through every note, let go. Whoever holds the lock runs.
 * When the budget runs out first, the note goes back and a fresh invocation takes over.
 */
async function sync(kind: Kind): Promise<void> {
  const deadline = Date.now() + BUDGET_MS;
  // One connection, so the advisory lock belongs to this run and dies with it.
  const sql = postgres(env('SUPABASE_DB_URL'), { max: 1 });
  let handOver: Kind | null = null;
  try {
    await leaveNote(sql, kind);
    while (await tryLock(sql)) {
      try {
        for (let next = await takeNote(sql); next; next = await takeNote(sql)) {
          if ((await runOnce(sql, next, deadline)) === 'out_of_time') {
            await leaveNote(sql, next);
            handOver = next;
            break;
          }
        }
      } finally {
        await sql`select pg_advisory_unlock(${LOCK_KEY})`;
      }
      // A note left between the last look and the unlock is someone's to run: ours if still there.
      if (handOver || (await readState(sql, 'pending')) === null) break;
    }
  } finally {
    await sql.end();
  }
  if (handOver) await chain(handOver);
}

async function runOnce(sql: Sql, kind: Kind, deadline: number): Promise<Outcome> {
  const now = (): string => new Date().toISOString();
  await writeState(sql, 'running_since', now());
  await writeState(sql, 'last_kind', kind);
  let outcome: Outcome = 'done';
  try {
    // A rebuild that handed over mid-way carries on before anything else.
    const rebuilding = (await readState(sql, 'rebuild_started_at')) !== null;
    outcome =
      kind === 'forcerefresh' || rebuilding
        ? await rebuild(sql, deadline)
        : await pullEverything(sql, deadline);
    if (outcome === 'done') {
      await writeState(sql, 'last_success_at', now());
      await writeState(sql, 'last_error', null);
    }
  } catch (error) {
    // The cursor moved with every page that succeeded; the next run carries on from there.
    await writeState(sql, 'last_error', String(error));
    report('sync failed', { kind, detail: String(error) });
  } finally {
    // One transaction, so "not running" and the run count are never seen half-written.
    await sql.begin(async (tx) => {
      await writeState(tx, 'running_since', null);
      await writeState(tx, 'last_finished_at', now());
      await tx`insert into core_sync_state (name, value) values ('runs', '1')
               on conflict (name) do update set value = (core_sync_state.value::bigint + 1)::text`;
    });
  }
  return outcome;
}

/** A delta: every datatype from its cursor, in reference order. */
async function pullEverything(sql: Sql, deadline: number): Promise<Outcome> {
  for (const datatype of DATATYPES) {
    const result = await pull(sql, datatype, false, deadline);
    if (result === 'resync_required') return rebuild(sql, deadline);
    if (result === 'out_of_time') return 'out_of_time';
  }
  return 'done';
}

/**
 * Page through /v1/changes from the stored cursor. Each page and its cursor commit together, so a
 * failure never leaves the cursor ahead of the data, and a hand-over mid-way loses nothing.
 */
async function pull(
  sql: Sql,
  datatype: Datatype,
  rewriteAll: boolean,
  deadline: number,
): Promise<'ok' | 'resync_required' | 'out_of_time'> {
  let after = Number((await readState(sql, `after.${datatype}`)) ?? 0);
  for (;;) {
    const response = await fetch(
      `${env('CORE_URL')}/v1/changes?datatype=${datatype}&after=${after}`,
      {
        headers: {
          authorization: `Bearer ${env('CORE_TENANT_TOKEN')}`,
          'x-core-client': `lovable-kit/${VERSION}`,
        },
      },
    );
    if (response.status === 409) return 'resync_required';
    if (!response.ok) throw new Error(`pull ${datatype} after ${after}: http ${response.status}`);

    const page = (await response.json()) as Page;
    await sql.begin(async (tx) => {
      for (const item of page.items) await write(tx, datatype, item, rewriteAll);
      await writeState(tx, `after.${datatype}`, String(page.next_after));
    });

    after = page.next_after;
    if (!page.has_more) return 'ok';
    if (Date.now() > deadline) return 'out_of_time';
  }
}

/** One item from a page: a tombstone deletes, anything else is upserted unless its hash is stored. */
async function write(sql: Sql, datatype: Datatype, item: Item, rewriteAll: boolean): Promise<void> {
  const table = sql(TABLE[datatype]);

  if (!usable(item)) {
    // Skipped and reported, and the loop goes on (SRS §8 resilience).
    report('skipped an item this client cannot use', {
      datatype,
      connection_id: item?.connection_id,
      remote_id: item?.remote_id,
      seq: item?.seq,
    });
    return;
  }

  if (item.deleted) {
    await sql`delete from ${table}
              where connection_id = ${item.connection_id} and remote_id = ${item.remote_id}`;
    return;
  }

  // The hash is the skip test: a row that already holds this content is left alone, unless
  // everything is being rewritten. `synced_at` is bookkeeping for the rebuild sweep only.
  await sql`insert into ${table}
              (connection_id, remote_id, office_id, seq, content_hash, remote_updated_at, data, synced_at)
            values (${item.connection_id}, ${item.remote_id}, ${item.office_id}, ${item.seq},
                    ${item.content_hash}, ${item.remote_updated_at}, ${sql.json(item.data)}, now())
            on conflict (connection_id, remote_id) do update set
              office_id = excluded.office_id,
              seq = excluded.seq,
              content_hash = excluded.content_hash,
              remote_updated_at = excluded.remote_updated_at,
              data = excluded.data,
              synced_at = excluded.synced_at
            where ${rewriteAll}::boolean or ${table}.content_hash <> excluded.content_hash`;
}

const usable = (item: Item): boolean =>
  typeof item === 'object' &&
  item !== null &&
  typeof item.connection_id === 'string' &&
  item.connection_id !== '' &&
  typeof item.remote_id === 'string' &&
  item.remote_id !== '' &&
  (item.deleted === true || (typeof item.data === 'object' && item.data !== null));

/**
 * Pull everything from seq 0 and rewrite every row (forcerefresh, SRS §8), then drop what was not
 * seen, only once every page succeeded: the site keeps serving its old copy until then and is
 * never emptied (strategy §7). Also the answer to resync_required. The start time is kept in the
 * state, so a rebuild that hands over mid-way carries on from its cursors instead of starting again.
 */
async function rebuild(sql: Sql, deadline: number): Promise<Outcome> {
  let started = await readState(sql, 'rebuild_started_at');
  if (started === null) {
    const [row] = await sql<{ now: Date }[]>`select now() as now`;
    started = row.now.toISOString();
    await sql.begin(async (tx) => {
      for (const datatype of DATATYPES) await writeState(tx, `after.${datatype}`, '0');
      await writeState(tx, 'rebuild_started_at', started);
    });
  }
  for (const datatype of DATATYPES) {
    const result = await pull(sql, datatype, true, deadline);
    if (result === 'resync_required') throw new Error('resync required from seq 0');
    if (result === 'out_of_time') return 'out_of_time';
  }
  for (const datatype of DATATYPES) {
    await sql`delete from ${sql(TABLE[datatype])} where synced_at < ${started}::timestamptz`;
  }
  await writeState(sql, 'rebuild_started_at', null);
  return 'done';
}

/** Hand the rest of the work to a fresh invocation: one bell, however many runs it takes. */
async function chain(kind: Kind): Promise<void> {
  const base = Deno.env.get('SUPABASE_URL');
  if (!base) {
    report('cannot chain: SUPABASE_URL is not set; the scheduled run carries on instead');
    return;
  }
  const response = await fetch(`${base}/functions/v1/core-sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-core-secret': env('CORE_BELL_SECRET') },
    body: JSON.stringify({ kind }),
  });
  if (response.status !== 202) report('chain refused', { status: response.status });
}

async function readState(sql: Sql, name: string): Promise<string | null> {
  const rows = await sql<
    { value: string }[]
  >`select value from core_sync_state where name = ${name}`;
  return rows[0]?.value ?? null;
}

async function writeState(sql: Sql, name: string, value: string | null): Promise<void> {
  if (value === null) {
    await sql`delete from core_sync_state where name = ${name}`;
  } else {
    await sql`insert into core_sync_state (name, value) values (${name}, ${value})
              on conflict (name) do update set value = excluded.value`;
  }
}

/** The note a bell leaves for whoever is syncing. forcerefresh outranks delta. */
async function leaveNote(sql: Sql, kind: Kind): Promise<void> {
  await sql`insert into core_sync_state (name, value) values ('pending', ${kind})
            on conflict (name) do update set value =
              case when core_sync_state.value = 'forcerefresh' then core_sync_state.value
                   else excluded.value end`;
}

/** Read and clear the note in one step, so two runners never work the same note. */
function takeNote(sql: Sql): Promise<Kind | null> {
  return sql.begin(async (tx) => {
    const rows = await tx<{ value: Kind }[]>`select value from core_sync_state
                                             where name = 'pending' for update`;
    if (rows.length === 0) return null;
    await tx`delete from core_sync_state where name = 'pending'`;
    return rows[0].value;
  });
}

async function tryLock(sql: Sql): Promise<boolean> {
  const [row] = await sql<
    { locked: boolean }[]
  >`select pg_try_advisory_lock(${LOCK_KEY}) as locked`;
  return row.locked;
}
