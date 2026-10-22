// What a client's test driver is, shared by the sync scenario suite (sync-scenarios.ts), the
// template suite and the browser journeys: the names a client is started with, the shape of its
// driver, and a free port for its process. No test runner is imported here, so a journey's site
// script can run it outside one.
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';

export const BELL_SECRET = 'client-bell-secret';
export const CONNECTION = 'polling-acme';

export type Kind = 'delta' | 'forcerefresh';

export type ClientItem = {
  connection_id: string;
  remote_id: string;
  content_hash: string;
  /** The client's own write time: bookkeeping these tests read, and nothing else may. */
  synced_at: string;
  data: Record<string, unknown> | null;
  /** The CRM payload as Core served it, kept next to data (Patric, 2026-09-18). */
  raw?: Record<string, unknown> | null;
};

export type ClientStatus = {
  runs: number;
  pending: string | null;
  running_since: string | null;
  last_success_at: string | null;
  last_error: string | null;
  /** What the site's own administrator is told while it is not syncing (WordPress). */
  notice?: string | null;
  after: Record<string, number>;
};

export type CoreDetails = { url: string; token: string; bellSecret: string };

export type ClientDriver = {
  /** Where Core rings. */
  bellUrl: string;
  /** Ring the client yourself; resolves to the HTTP status. */
  bell(kind: Kind, secret: string): Promise<number>;
  /** Start a sync the way the client's own trigger would. May return before the sync is done. */
  trigger(kind: Kind): Promise<void>;
  /** Run the client's scheduled backstop once. May return before the sync is done. */
  backstop(): Promise<void>;
  items(datatype: string): Promise<ClientItem[]>;
  status(): Promise<ClientStatus>;
  /** Corrupt one stored item's data without touching its hash: damage a delta sync never sees. */
  damage(datatype: string, remoteId: string): Promise<void>;
};

export type ClientSetup = {
  /** Start the client against this Core. Called before every scenario. */
  start(core: CoreDetails): Promise<ClientDriver>;
  /** Stop it. Called after every scenario. */
  stop(): Promise<void>;
};

/** A port nobody is listening on, for a client process to take. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}
