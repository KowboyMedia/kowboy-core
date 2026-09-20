// The queries several pages share, with their keys, so the live feed can refresh them by key.
import { api } from '@/api/client';
import type { Provider, Session, TenantListRow } from '@/api/types';

export const sessionQuery = () => ({
  queryKey: ['session'],
  queryFn: () => api<Session>('/v1/admin/session'),
  retry: false,
  staleTime: 60_000,
});

export const providersQuery = () => ({
  queryKey: ['providers'],
  queryFn: async () => (await api<{ providers: Provider[] }>('/v1/admin/providers')).providers,
  staleTime: 5 * 60_000,
});

export const tenantsQuery = () => ({
  queryKey: ['tenants'],
  queryFn: async () => (await api<{ tenants: TenantListRow[] }>('/v1/admin/tenants')).tenants,
});

/** The path of a record's page. */
export const recordPath = (connectionId: string, datatype: string, remoteId: string): string =>
  `/records/${encodeURIComponent(connectionId)}/${datatype}/${encodeURIComponent(remoteId)}`;
