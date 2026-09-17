import type {
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
}
