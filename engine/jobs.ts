// Long operations run as jobs (docs/admin-panel.md): the panel or the admin API queues one, the
// worker takes it, and the row carries its progress, its result and its history. Today one kind:
// a recompute of a scope, as a dry run (the impact preview, AC 36) or for real.
import { db } from './storage/db.js';
import { logEvent } from './events.js';
import { report } from './errors.js';
import { inMaintenance } from './storage/settings.js';
import { recompute, type Progress, type Scope } from './recompute.js';

export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export type JobRow = {
  id: string;
  kind: 'recompute';
  scope: Scope;
  dry_run: boolean;
  state: JobState;
  /** The report so far; empty until the first batch. */
  progress: Partial<Progress> & { updated_at?: string };
  result: Progress | null;
  error: string | null;
  requested_by: string | null;
  cancel_requested: boolean;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
};

/** A running job whose progress has not moved for this long lost its worker. */
export const STALE_MS = 10 * 60_000;

/** Queue a job. The worker takes it within seconds. */
export async function createJob(input: {
  kind: 'recompute';
  scope: Scope;
  dryRun: boolean;
  requestedBy: string | null;
}): Promise<number> {
  const { rows } = await db().query<{ id: string }>(
    `insert into jobs (kind, scope, dry_run, requested_by) values ($1, $2, $3, $4) returning id`,
    [input.kind, JSON.stringify(input.scope), input.dryRun, input.requestedBy],
  );
  const id = Number(rows[0]?.id);
  await logEvent({
    type: 'job.queued',
    tenantId: input.scope.tenantId ?? null,
    connectionId: input.scope.connectionId ?? null,
    fields: { job: id, kind: input.kind, dry_run: input.dryRun, scope: input.scope },
  });
  return id;
}

export async function getJob(id: number): Promise<JobRow | null> {
  const { rows } = await db().query<JobRow>('select * from jobs where id = $1', [id]);
  return rows[0] ?? null;
}

/** The newest jobs first. */
export async function listJobs(limit = 50): Promise<JobRow[]> {
  const { rows } = await db().query<JobRow>('select * from jobs order by id desc limit $1', [
    Math.min(Math.max(limit, 1), 500),
  ]);
  return rows;
}

/** Jobs still queued or running, for the live stream. */
export async function openJobs(): Promise<JobRow[]> {
  const { rows } = await db().query<JobRow>(
    'select * from jobs where finished_at is null order by id',
  );
  return rows;
}

/**
 * Ask a job to stop. A queued one is cancelled at once; a running one stops after its current
 * batch and keeps the report so far. False when the job is already finished.
 */
export async function cancelJob(id: number): Promise<boolean> {
  const { rowCount } = await db().query(
    `update jobs set
       cancel_requested = true,
       state = case when state = 'queued' then 'cancelled' else state end,
       finished_at = case when state = 'queued' then now() else finished_at end
     where id = $1 and finished_at is null`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}

/** Take the oldest queued job and run it to the end. The worker's tick; true when one ran. */
export async function runNextJob(): Promise<boolean> {
  // Maintenance holds the queue: a job stays queued until the switch is turned off.
  if (await inMaintenance()) return false;
  const { rows } = await db().query<JobRow>(
    `update jobs set state = 'running', started_at = now()
     where id = (select id from jobs where state = 'queued' order by id limit 1 for update skip locked)
     returning *`,
  );
  const job = rows[0];
  if (!job) return false;
  const id = Number(job.id);
  let cancelled = false;
  try {
    const result = await recompute(job.scope, {
      dryRun: job.dry_run,
      onProgress: async (progress) => {
        const { rows: state } = await db().query<{ cancel_requested: boolean }>(
          `update jobs set progress = $2 where id = $1 returning cancel_requested`,
          [id, JSON.stringify({ ...progress, updated_at: new Date().toISOString() })],
        );
        cancelled = state[0]?.cancel_requested === true;
        return !cancelled;
      },
    });
    await finish(job, cancelled ? 'cancelled' : 'done', result, null);
  } catch (error) {
    report(error, { where: 'job', job: id, kind: job.kind });
    await finish(job, 'failed', null, String(error));
  }
  return true;
}

async function finish(
  job: JobRow,
  state: JobState,
  result: Progress | null,
  error: string | null,
): Promise<void> {
  await db().query(
    `update jobs set state = $2, result = $3, error = $4, finished_at = now(),
       progress = coalesce($3, progress) where id = $1`,
    [job.id, state, result ? JSON.stringify(result) : null, error],
  );
  await logEvent({
    type: `job.${state}`,
    tenantId: job.scope.tenantId ?? null,
    connectionId: job.scope.connectionId ?? null,
    fields: {
      job: Number(job.id),
      kind: job.kind,
      dry_run: job.dry_run,
      examined: result?.examined ?? null,
      changed: result?.changed ?? null,
      failed: result?.failed ?? null,
      error,
    },
  });
}

/** A running job whose worker stopped reporting is failed, so nothing waits on it for ever. */
export async function failStaleJobs(): Promise<number> {
  const { rowCount } = await db().query(
    `update jobs set state = 'failed', error = 'the worker stopped while running this job', finished_at = now()
     where state = 'running'
       and coalesce((progress->>'updated_at')::timestamptz, started_at) < now() - ($1 || ' milliseconds')::interval`,
    [String(STALE_MS)],
  );
  return rowCount ?? 0;
}
