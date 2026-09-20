// The panel's live feed: one server-sent event stream per open page. One poller per process reads
// what is new in the event log and the jobs table every second and sends it to every listener,
// so the page updates as things happen without a reload. A comment every 15 seconds keeps the
// connection alive through proxies.
import type { ServerResponse } from 'node:http';
import { latestEventId, queryEvents } from '../events.js';
import { openJobs, type JobRow } from '../jobs.js';
import { report } from '../errors.js';

const POLL_MS = 1_000;
const PING_MS = 15_000;
const BATCH = 500;

const listeners = new Set<ServerResponse>();
let cursor = 0;
let timer: NodeJS.Timeout | null = null;
let pinger: NodeJS.Timeout | null = null;
let lastJobs = '';
let polling = false;

function send(event: string, data: unknown): void {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const listener of listeners) listener.write(frame);
}

async function poll(): Promise<void> {
  if (polling || listeners.size === 0) return;
  polling = true;
  try {
    const events = await queryEvents({ afterId: cursor, limit: BATCH });
    if (events.length > 0) {
      cursor = Number(events[events.length - 1]?.id ?? cursor);
      send('events', { events });
    }
    const jobs = await openJobs();
    const snapshot = JSON.stringify(jobs.map((job) => [job.id, job.state, job.progress]));
    if (snapshot !== lastJobs) {
      lastJobs = snapshot;
      send('jobs', { jobs: jobs.map(summary) });
    }
  } catch (error) {
    report(error, { where: 'admin stream' });
  } finally {
    polling = false;
  }
}

const summary = (job: JobRow): Record<string, unknown> => ({
  id: Number(job.id),
  kind: job.kind,
  state: job.state,
  dry_run: job.dry_run,
  progress: job.progress,
});

function start(): void {
  if (timer) return;
  timer = setInterval(() => void poll(), POLL_MS);
  timer.unref?.();
  pinger = setInterval(() => {
    for (const listener of listeners) listener.write(': ping\n\n');
  }, PING_MS);
  pinger.unref?.();
}

function stop(): void {
  if (timer) clearInterval(timer);
  if (pinger) clearInterval(pinger);
  timer = null;
  pinger = null;
}

/** Take over the response: headers, the first frame, and a place in the listeners until the browser leaves. */
export async function openStream(outgoing: ServerResponse): Promise<void> {
  if (listeners.size === 0) {
    cursor = await latestEventId();
    lastJobs = '';
  }
  outgoing.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  outgoing.write(`event: hello\ndata: ${JSON.stringify({ cursor })}\n\n`);
  listeners.add(outgoing);
  start();
  outgoing.on('close', () => {
    listeners.delete(outgoing);
    if (listeners.size === 0) stop();
  });
}

/** Test helper: how many pages are listening. */
export const listenerCount = (): number => listeners.size;
