// The live feed: one server-sent event stream per open page. What arrives tells the page which
// queries to refresh, so lists, figures and jobs change on the page without a reload.
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type StreamState = 'connecting' | 'live' | 'off';

/** Which queries an event batch touches, beyond the ones that always do. */
const TOUCHED: Record<string, string[]> = {
  'entity.': ['activity', 'items', 'item', 'tenant', 'dashboard', 'figures'],
  'site.': ['activity', 'item', 'tenant', 'dashboard', 'figures'],
  bell: ['tenant', 'dashboard'],
  pull: ['tenant', 'dashboard'],
  'lifecycle.': ['tenant', 'dashboard'],
  'admin.': ['tenant', 'tenants'],
  'job.': ['jobs', 'job', 'dashboard'],
  'alert.': ['dashboard'],
};

export function useStream(enabled: boolean): StreamState {
  const client = useQueryClient();
  const [state, setState] = useState<StreamState>('connecting');

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource('/v1/admin/stream');
    let pending = new Set<string>();
    let timer: number | null = null;
    const flush = (): void => {
      timer = null;
      for (const key of pending) void client.invalidateQueries({ queryKey: [key] });
      pending = new Set();
    };
    const touch = (keys: string[]): void => {
      for (const key of keys) pending.add(key);
      timer ??= window.setTimeout(flush, 400);
    };
    source.onopen = () => setState('live');
    source.onerror = () => setState('off');
    source.addEventListener('events', (message) => {
      const { events } = JSON.parse((message as MessageEvent<string>).data) as {
        events: { type: string }[];
      };
      touch(['events']);
      for (const event of events) {
        for (const [prefix, keys] of Object.entries(TOUCHED))
          if (event.type.startsWith(prefix)) touch(keys);
      }
    });
    source.addEventListener('jobs', () => touch(['jobs', 'job', 'dashboard']));
    return () => {
      source.close();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [client, enabled]);

  return state;
}
