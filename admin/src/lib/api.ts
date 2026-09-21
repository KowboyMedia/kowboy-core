// Every call the app makes goes through here, to Core's admin API. There is no second way to
// reach Core from the browser, so what the app can do an agent can do (docs/admin-panel-design.md §3).

export const API = '/v1/admin';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
};

export function withQuery(path: string, query: Options['query']): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  return search.size > 0 ? `${path}?${search}` : path;
}

/** One call. A refusal comes back as an `ApiError` carrying Core's own words. */
export async function call<T>(path: string, options: Options = {}): Promise<T> {
  const response = await fetch(withQuery(`${API}${path}`, options.query), {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? {} : { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'same-origin',
  });
  const text = await response.text();
  const parsed = text === '' ? {} : (JSON.parse(text) as Record<string, unknown>);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      String(parsed['error'] ?? `Core answered ${response.status}.`),
    );
  }
  return parsed as T;
}

/** What every single record answers. */
export const one = async <T>(path: string, options: Options = {}): Promise<T> =>
  (await call<{ data: T }>(path, options)).data;

/** What every list answers. */
export const many = <T>(
  path: string,
  options: Options = {},
): Promise<{ data: T[]; total: number }> => call<{ data: T[]; total: number }>(path, options);

export type SignInOutcome = {
  sent: boolean;
  detail: string;
  /** Only where Core cannot send mail, which is a machine running it locally. */
  link?: string;
};

/** Ask for a sign-in link. The sign-in page and Refine's auth provider both call this one. */
export const requestSignIn = (email: string): Promise<SignInOutcome> =>
  call<SignInOutcome>('/sign-in', { method: 'POST', body: { email } });
