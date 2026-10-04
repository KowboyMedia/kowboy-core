import type {
  Adapter,
  AdapterAdmin,
  Datatype,
  HealthResult,
  LifecycleHandler,
  Manifest,
  Mapper,
  Mappers,
} from './adapter-api/types.js';

/**
 * What the engine remembers about the adapters that registered. The engine looks entries up by
 * provider string; it never knows what a provider is (SRS §4.1).
 */
type Registration = { manifest: Manifest; mappers: Mappers };

const registrations = new Map<string, Registration>();
const lifecycleHandlers = new Map<string, LifecycleHandler[]>();
const healthChecks = new Map<string, () => Promise<HealthResult> | HealthResult>();
const admins = new Map<string, AdapterAdmin>();
/** An adapter's `submit` and `slots` (docs/forms.md), what the web process calls for a site's form. */
export type SubmissionHandlers = Pick<Adapter, 'submit' | 'slots'>;
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
 * What an adapter does with a form submission. Registered for both roles like the admin: the
 * web process answers a site's form inside the request (the departure approved with question
 * 130), and the engine hands the submission on without reading what the CRM makes of it.
 */
export function registerSubmissions(provider: string, handlers: SubmissionHandlers): void {
  submissionHandlers.set(provider, { submit: handlers.submit, slots: handlers.slots });
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

/** Test helper: a fresh process has an empty registry. */
export function clearRegistry(): void {
  registrations.clear();
  lifecycleHandlers.clear();
  healthChecks.clear();
  admins.clear();
  submissionHandlers.clear();
}
