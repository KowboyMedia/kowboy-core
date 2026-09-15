// The only engine module an adapter may import (strategy §3.1 E2). Protected path: changes need
// approval. Everything here is idempotent, and the engine never calls CRM-specific code except
// through the mappers and lifecycle handlers an adapter registers.
import { ingest, notFound, presentIds } from '../ingest.js';
import { logEvent } from '../events.js';
import { connectionsForProvider } from '../storage/connections.js';
import * as registry from '../registry.js';
import type {
  Adapter,
  AdapterApi,
  Connection,
  Datatype,
  HealthResult,
  LifecycleHandler,
  Manifest,
  Mappers,
} from './types.js';

export type {
  Adapter,
  AdapterApi,
  Canonical,
  Connection,
  Datatype,
  HealthResult,
  IngestResult,
  LifecycleEvent,
  LifecycleHandler,
  Manifest,
  MappedRecord,
  Mapper,
  Mappers,
  Route,
  RouteRequest,
  RouteResponse,
} from './types.js';
export { DATATYPES } from './types.js';

/** Build the API handed to one adapter's `start`. */
export function adapterApi(provider: string): AdapterApi {
  return {
    register(manifest: Manifest, mappers: Mappers): void {
      registry.register(provider, manifest, mappers);
    },
    ingest(connection, datatype, remoteId, raw, options) {
      return ingest(connection, datatype, remoteId, raw, options ?? {});
    },
    notFound(connection: Connection, datatype: Datatype, remoteId: string) {
      return notFound(connection, datatype, remoteId);
    },
    presentIds(connection, datatype, scope, ids) {
      return presentIds(connection, datatype, scope, ids);
    },
    onLifecycle(handler: LifecycleHandler): void {
      registry.addLifecycleHandler(provider, handler);
    },
    logEvent(type: string, fields: Record<string, unknown>) {
      return logEvent({ type, fields, connectionId: null });
    },
    healthCheck(name: string, check: () => Promise<HealthResult> | HealthResult): void {
      registry.addHealthCheck(name, check);
    },
    connections(): Promise<Connection[]> {
      return connectionsForProvider(provider);
    },
  };
}

/** Start one adapter with its own API instance. Called by main.ts only. */
export async function startAdapter(adapter: Adapter): Promise<void> {
  const api = adapterApi(adapter.manifest.provider);
  api.register(adapter.manifest, adapter.mappers);
  await adapter.start(api);
}
