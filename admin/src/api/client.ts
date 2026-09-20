// One way to call the admin API: JSON in and out, the panel's header on every change (the CSRF
// defence the API expects), and errors with their fields so a form can show them where they belong.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Init = { method?: Method; body?: unknown; signal?: AbortSignal };

const headersFor = (method: Method): Record<string, string> =>
  method === 'GET'
    ? { accept: 'application/json' }
    : {
        accept: 'application/json',
        'x-requested-with': 'core-admin',
        'content-type': 'application/json',
      };

const parse = (text: string): unknown => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

export async function api<T>(path: string, init: Init = {}): Promise<T> {
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: headersFor(method),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal ?? null,
  });
  const parsed = parse(await response.text());
  if (response.ok) return parsed as T;
  const body = (parsed ?? {}) as { error?: string; errors?: Record<string, string> };
  throw new ApiError(
    response.status,
    body.error ?? `${response.status} ${response.statusText}`,
    body.errors ?? {},
  );
}

/** The query string for a page's filters, empty values left out. */
export const qs = (
  params: Record<string, string | number | boolean | null | undefined>,
): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const isUnauthorized = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 401;

export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
