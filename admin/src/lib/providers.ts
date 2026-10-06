// The three providers Refine asks for, each doing exactly what its documentation describes
// (read 2026-09-20; §8 rule 7). The data provider speaks Core's admin API, the auth provider its
// sign-in, and the live provider the one server-sent stream.
import type { AuthProvider, DataProvider, LiveProvider, LiveEvent } from '@refinedev/core';
import { API, call, many, one, requestSignIn, withQuery } from './api';

export const dataProvider: DataProvider = {
  getApiUrl: () => API,

  async getList({ resource, pagination, sorters, filters }) {
    const query: Record<string, string | number | boolean | undefined> = {
      page: pagination?.currentPage,
      size: pagination?.pageSize,
    };
    const sort = sorters?.[0];
    if (sort) {
      query['sort'] = sort.field;
      query['dir'] = sort.order;
    }
    for (const filter of filters ?? []) {
      if (!('field' in filter)) continue;
      // Every page names its filters by the query parameter itself.
      if (filter.value === undefined || filter.value === null || filter.value === '') continue;
      query[filter.field] = String(filter.value);
    }
    return many<never>(`/${resource}`, { query });
  },

  async getOne({ resource, id }) {
    return { data: await one<never>(`/${resource}/${String(id)}`) };
  },

  async create({ resource, variables }) {
    return { data: await one<never>(`/${resource}`, { method: 'POST', body: variables }) };
  },

  async update({ resource, id, variables }) {
    return {
      data: await one<never>(`/${resource}/${String(id)}`, { method: 'PATCH', body: variables }),
    };
  },

  async deleteOne({ resource, id }) {
    return { data: await one<never>(`/${resource}/${String(id)}`, { method: 'DELETE' }) };
  },

  async custom({ url, method, payload, query }) {
    return {
      data: await one<never>(url, {
        method: (method?.toUpperCase() as 'GET' | 'POST' | 'PATCH' | 'DELETE') ?? 'GET',
        ...(payload === undefined ? {} : { body: payload }),
        ...(query === undefined ? {} : { query: query as Record<string, string> }),
      }),
    };
  },
};

export const authProvider: AuthProvider = {
  /** The sign-in page asks for a link; the link itself is what signs a person in. */
  async login({ email, remember }: { email?: string; remember?: boolean }) {
    const outcome = await requestSignIn(email ?? '', remember === true);
    // Nothing is redirected: the person now opens the link from their mail.
    return { success: outcome.sent, successNotification: { message: outcome.detail } };
  },

  async logout() {
    await call('/sign-out', { method: 'POST' });
    return { success: true, redirectTo: '/sign-in' };
  },

  async check() {
    try {
      await one('/me');
      return { authenticated: true };
    } catch {
      return { authenticated: false, redirectTo: '/sign-in' };
    }
  },

  async getIdentity() {
    try {
      return await one<{ email: string }>('/me');
    } catch {
      return null;
    }
  },

  async onError(error) {
    if ((error as { status?: number })?.status === 401) {
      return { logout: true, redirectTo: '/sign-in' };
    }
    return {};
  },
};

/** Which resources a message from the stream makes stale. */
const TOUCHED: Record<string, string[]> = {
  events: ['events', 'overview', 'records', 'tenants'],
  jobs: ['overview'],
  health: ['overview', 'settings'],
};

type Listener = (event: LiveEvent) => void;

/**
 * One `EventSource` for the whole app, shared by every subscription. Refine's `liveMode: "auto"`
 * then invalidates exactly the queries a message touches, which is the documented way to feed it.
 */
class Stream {
  private source: EventSource | null = null;
  private readonly listeners = new Map<string, Set<Listener>>();

  private open(): void {
    if (this.source) return;
    this.source = new EventSource(withQuery(`${API}/stream`, {}));
    for (const kind of Object.keys(TOUCHED)) {
      this.source.addEventListener(kind, (message) => this.fan(kind, message as MessageEvent));
    }
  }

  private fan(kind: string, message: MessageEvent<string>): void {
    let payload: unknown = null;
    try {
      payload = JSON.parse(message.data) as unknown;
    } catch {
      return;
    }
    for (const channel of TOUCHED[kind] ?? []) {
      for (const listener of this.listeners.get(`resources/${channel}`) ?? []) {
        listener({
          channel: `resources/${channel}`,
          type: 'updated',
          date: new Date(),
          payload: { kind, payload },
        });
      }
    }
  }

  subscribe(channel: string, listener: Listener): { channel: string; listener: Listener } {
    this.open();
    const set = this.listeners.get(channel) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(channel, set);
    return { channel, listener };
  }

  unsubscribe(handle: { channel: string; listener: Listener }): void {
    this.listeners.get(handle.channel)?.delete(handle.listener);
  }
}

const stream = new Stream();

export const liveProvider: LiveProvider = {
  subscribe: ({ channel, callback }) => stream.subscribe(channel, callback),
  unsubscribe: (handle) => stream.unsubscribe(handle as { channel: string; listener: Listener }),
};
