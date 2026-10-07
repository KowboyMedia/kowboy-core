import type {
  Adapter,
  AdapterAdmin,
  Connection,
  Datatype,
  HealthResult,
  LifecycleHandler,
  Manifest,
  Mapper,
  Mappers,
  SubmissionResult,
} from './adapter-api/types.js';
import { formsDryRun } from './storage/connections.js';

/**
 * What the engine remembers about the adapters that registered. The engine looks entries up by
 * provider string; it never knows what a provider is (SRS §4.1).
 */
type Registration = { manifest: Manifest; mappers: Mappers };

const registrations = new Map<string, Registration>();
const lifecycleHandlers = new Map<string, LifecycleHandler[]>();
const healthChecks = new Map<string, () => Promise<HealthResult> | HealthResult>();
const admins = new Map<string, AdapterAdmin>();
/**
 * An adapter's `submit` and `slots` (docs/forms.md), what the web process calls for a site's form,
 * and its `testSystem`, which only the guard asks.
 */
export type SubmissionHandlers = Pick<Adapter, 'submit' | 'slots' | 'testSystem'>;
const submissionHandlers = new Map<string, SubmissionHandlers>();

export function register(provider: string, manifest: Manifest, mappers: Mappers): void {
  registrations.set(provider, { manifest, mappers });
}

export function mapperFor(provider: string, datatype: Datatype): Mapper | null {
  return registrations.get(provider)?.mappers[datatype] ?? null;
}

export function manifestFor(provider: string): Manifest | null {
  return registrations.get(provider)?.manifest ?? null;
}

export function providers(): string[] {
  return [...registrations.keys()];
}

/**
 * What an adapter shows and does in the admin area, as data (`AdapterAdmin`). The entrypoint
 * registers it for both roles, because the web process draws the panel while the worker runs the
 * adapter; the engine hands the descriptions on and never inspects what they mean.
 */
export function registerAdmin(provider: string, admin: AdapterAdmin): void {
  admins.set(provider, admin);
}

export function adminFor(provider: string): AdapterAdmin | null {
  return admins.get(provider) ?? null;
}

/** The providers that brought a panel, in registration order. */
export function adminProviders(): string[] {
  return [...admins.keys()];
}

/**
 * Whether this Core is the live service, the only one that writes to a live CRM (question 152):
 * staging reads a real brokerage's office, so nothing tried there may reach it. A CRM's own test
 * system takes forms from any Core (question 181). Set once at start from the environment's name;
 * a Core never told stays off.
 */
let live = false;
/**
 * The answer to a form the guard holds back, a dry run: outside the live service, or through a
 * connection ticked to dry-run its forms. The visitor reads it; nothing is wrong, so no alert.
 */
export const NOT_LIVE =
  'Det här är en testsida, så formuläret skickades inte vidare till mäklaren.';
const held = (): SubmissionResult => ({ outcome: 'refused', reason: NOT_LIVE });

export function configureLiveService(settings: { live: boolean }): void {
  live = settings.live;
}

export const isLiveService = (): boolean => live;

/**
 * What an adapter does with a form submission. Registered for both roles like the admin: the
 * web process answers a site's form inside the request (the departure approved with question
 * 130), and the engine hands the submission on without reading what the CRM makes of it.
 *
 * The guard sits here. The engine never imports adapter code (the seam, checked on every
 * change), so this is the one place it gets an adapter's `submit`, and the registry keeps only
 * the guarded one, which answers refused with `NOT_LIVE` and never calls the adapter in two
 * cases. First, a connection ticked to dry-run its forms holds every form, on the live service
 * too (Patric, 2026-10-07: "prevent hot leads, only dry run"); the tick is read at each send, so
 * it holds from the moment it is saved, and a database that does not answer fails the form
 * rather than send it. Second, outside the live service, unless the adapter says the connection
 * is its own test system (question 181); the same connection is then handed to `submit`, so the
 * send goes where the answer was given. A site's form, "Send again" and any way to a CRM added
 * later all pass it without anyone putting it there. Reading a viewing's times is no write and is
 * not guarded.
 */
export function registerSubmissions(provider: string, handlers: SubmissionHandlers): void {
  const { submit, slots, testSystem } = handlers;
  // An answer the adapter cannot give counts as a live CRM, so the form is held.
  const sends = (connection: Connection): boolean => {
    if (live) return true;
    try {
      return testSystem?.(connection) === true;
    } catch {
      return false;
    }
  };
  submissionHandlers.set(provider, {
    submit:
      submit &&
      (async (connection, submission) =>
        (await formsDryRun(connection.id)) || !sends(connection)
          ? held()
          : submit(connection, submission)),
    slots,
  });
}

export function submissionsFor(provider: string): SubmissionHandlers | null {
  return submissionHandlers.get(provider) ?? null;
}

export function addLifecycleHandler(provider: string, handler: LifecycleHandler): void {
  const handlers = lifecycleHandlers.get(provider) ?? [];
  handlers.push(handler);
  lifecycleHandlers.set(provider, handlers);
}

export function lifecycleHandlersFor(provider: string): LifecycleHandler[] {
  return lifecycleHandlers.get(provider) ?? [];
}

export function addHealthCheck(
  name: string,
  check: () => Promise<HealthResult> | HealthResult,
): void {
  healthChecks.set(name, check);
}

export function registeredHealthChecks(): Map<string, () => Promise<HealthResult> | HealthResult> {
  return healthChecks;
}

/** Test helper: a fresh process has an empty registry, and is not the live service. */
export function clearRegistry(): void {
  registrations.clear();
  lifecycleHandlers.clear();
  healthChecks.clear();
  admins.clear();
  submissionHandlers.clear();
  live = false;
}
