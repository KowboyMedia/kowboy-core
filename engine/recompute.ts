import { contentHash } from './json.js';
import { validateData, SCHEMA_VERSION } from './contract.js';
import { applyRules, RULES_VERSION } from './rules/run.js';
import { mapperFor } from './registry.js';
import { logEvent } from './events.js';
import { ring } from './bells.js';
import { takeWriteLock, transaction } from './storage/db.js';
import {
  countItems,
  scopeBatch,
  writeItem,
  type ItemRow,
  type ScopeFilter,
} from './storage/items.js';
import { connectionById } from './storage/connections.js';
import { changedFields } from './ingest.js';
import type { Canonical, Datatype } from './adapter-api/types.js';

/**
 * What to recompute: everything, a CRM, a tenant, a connection, an office, a datatype, one
 * record, a selection, or only the rows an older rules version produced (SRS §3).
 */
export type Scope = Omit<ScopeFilter, 'rulesVersionBefore'> & { staleRulesOnly?: boolean };

export type ImpactReport = {
  examined: number;
  changed: number;
  unchanged: number;
  failed: number;
  /** The first failures, up to the limit; `failed` counts them all. */
  failures: { remoteId: string; datatype: Datatype; connectionId: string; errors: string[] }[];
  examples: {
    remoteId: string;
    datatype: Datatype;
    connectionId: string;
    changed: Record<string, { from: unknown; to: unknown }>;
  }[];
};

export type Progress = ImpactReport & { total: number };

export type RecomputeOptions = {
  /** The release impact preview (AC 36): everything examined, nothing written. */
  dryRun?: boolean;
  exampleLimit?: number;
  failureLimit?: number;
  /** Called after every batch; answer false to stop, and the report so far comes back. */
  onProgress?: (progress: Progress) => Promise<boolean | void> | boolean | void;
};

const BATCH = 200;

/**
 * Re-run mappers, rules and `display` over stored `raw`, with no CRM traffic (SRS §4.7, §7).
 * Replay and recompute are the same operation: raw is always stored, so one code path serves both.
 * Runs in pages by seq, so a recompute of everything never holds everything in memory and can
 * report progress or stop between pages.
 */
export async function recompute(scope: Scope, options: RecomputeOptions = {}): Promise<Progress> {
  const exampleLimit = options.exampleLimit ?? 10;
  const failureLimit = options.failureLimit ?? 200;
  const filter: ScopeFilter = {
    ...scope,
    rulesVersionBefore: scope.staleRulesOnly ? RULES_VERSION : undefined,
  };
  const report: Progress = {
    total: await countItems(filter),
    examined: 0,
    changed: 0,
    unchanged: 0,
    failed: 0,
    failures: [],
    examples: [],
  };
  const touchedTenants = new Set<number>();
  const mappers = new Map<string, Awaited<ReturnType<typeof mapperOf>>>();
  const examine = async (item: ItemRow): Promise<void> => {
    if (!mappers.has(item.connection_id)) {
      mappers.set(item.connection_id, await mapperOf(item.connection_id));
    }
    const outcome = redo(item, mappers.get(item.connection_id) ?? null);
    note(report, item, outcome, { exampleLimit, failureLimit });
    if (outcome.status !== 'changed' || options.dryRun) return;
    await store(item, outcome);
    touchedTenants.add(item.tenant_id);
  };

  // Two passes: the records not sold first, the sold ones last (question 74).
  let goOn = true;
  for (const sold of [false, true]) {
    let afterSeq = 0;
    let more = true;
    while (goOn && more) {
      const items = await scopeBatch(filter, sold, afterSeq, BATCH);
      for (const item of items) {
        afterSeq = Number(item.seq);
        await examine(item);
      }
      const wanted = items.length > 0 ? await options.onProgress?.(report) : undefined;
      more = items.length === BATCH;
      goOn = wanted !== false;
    }
  }

  for (const tenantId of touchedTenants) await ring(tenantId);
  return report;
}

/** One outcome onto the report: the counts, and the first failures and examples up to their limits. */
function note(
  report: Progress,
  item: ItemRow,
  outcome: Redone,
  limits: { exampleLimit: number; failureLimit: number },
): void {
  report.examined += 1;
  if (outcome.status === 'failed') {
    report.failed += 1;
    if (report.failures.length < limits.failureLimit) {
      report.failures.push({
        remoteId: item.remote_id,
        datatype: item.datatype,
        connectionId: item.connection_id,
        errors: outcome.errors,
      });
    }
    return;
  }
  if (outcome.status === 'unchanged') {
    report.unchanged += 1;
    return;
  }
  report.changed += 1;
  if (report.examples.length < limits.exampleLimit) {
    report.examples.push({
      remoteId: item.remote_id,
      datatype: item.datatype,
      connectionId: item.connection_id,
      changed: changedFields(item.data, outcome.data),
    });
  }
}

type Redone =
  | { status: 'failed'; errors: string[] }
  | { status: 'unchanged' }
  | {
      status: 'changed';
      data: Canonical;
      hash: string;
      officeId: string | null;
      remoteUpdatedAt: string | null;
    };

type MapperOf =
  | ((raw: unknown) => { data: Canonical; officeId: string | null; remoteUpdatedAt: string | null })
  | null;

/** The mapper for a connection's datatypes, found once per connection. */
async function mapperOf(connectionId: string): Promise<(datatype: Datatype) => MapperOf> {
  const connection = await connectionById(connectionId);
  return (datatype) => (connection ? mapperFor(connection.provider, datatype) : null);
}

/** One stored row, put back through the current mappers and rules. */
function redo(item: ItemRow, mappers: ((datatype: Datatype) => MapperOf) | null): Redone {
  const mapper = mappers?.(item.datatype);
  if (!mapper) return { status: 'failed', errors: ['no adapter registered for this connection'] };

  let mapped;
  try {
    mapped = mapper(item.raw);
  } catch (error) {
    return { status: 'failed', errors: [String(error)] };
  }

  const data = applyRules(item.datatype, mapped.data);
  const validation = validateData(item.datatype, data);
  if (!validation.valid) return { status: 'failed', errors: validation.errors };

  const hash = contentHash(data);
  if (hash === item.content_hash && item.rules_version === RULES_VERSION) {
    return { status: 'unchanged' };
  }
  return {
    status: 'changed',
    data,
    hash,
    officeId: mapped.officeId,
    remoteUpdatedAt: mapped.remoteUpdatedAt,
  };
}

/** Write the recomputed row with a fresh seq, and log the change with its fields. */
async function store(
  item: ItemRow,
  outcome: Extract<Redone, { status: 'changed' }>,
): Promise<void> {
  const seq = await transaction(async (client) => {
    await takeWriteLock(client);
    return writeItem(client, {
      tenantId: item.tenant_id,
      connectionId: item.connection_id,
      datatype: item.datatype,
      remoteId: item.remote_id,
      officeId: outcome.officeId,
      contentHash: outcome.hash,
      raw: item.raw,
      data: outcome.data,
      remoteUpdatedAt: outcome.remoteUpdatedAt ?? item.remote_updated_at?.toISOString() ?? null,
      rulesVersion: RULES_VERSION,
      schemaVersion: SCHEMA_VERSION,
      deleted: false,
    });
  });
  await logEvent({
    type: 'entity.written',
    tenantId: item.tenant_id,
    connectionId: item.connection_id,
    datatype: item.datatype,
    remoteId: item.remote_id,
    fields: {
      seq,
      cause: 'recompute',
      old_hash: item.content_hash,
      new_hash: outcome.hash,
      changed: changedFields(item.data, outcome.data),
      rules_version: RULES_VERSION,
    },
  });
}
