// What every panel gets: the request, the parsed form, the URL parameters, the CSRF token, the
// adapters that brought panels, a little configuration, and two ways to answer: a page in the
// shell, or a redirect with a message.
import { page, type NavItem } from './html.js';
import { HTML } from './auth.js';
import type { Request, Response } from '../http/server.js';
import type { AdapterAdmin } from '../adapter-api/types.js';

export type AdminAdapter = { provider: string; admin?: AdapterAdmin };

export type AdminConfig = {
  version: string;
  /** Email domains whose addresses may log in, and the login mail's sender. */
  loginDomains: string[];
  mailFrom: string | null;
  pageSize: number;
  bellThrottleMs: number;
  eventRetentionDays: number;
  tombstoneRetentionDays: number;
  gzipLevel: number;
};

export type Ctx = {
  request: Request;
  form: Record<string, string>;
  /** The captures of the panel's pattern, decoded. */
  params: string[];
  csrf: string;
  /** The address logged in. */
  user: string;
  adapters: AdminAdapter[];
  config: AdminConfig;
  render(title: string, body: string, flash?: string | null): Response;
  redirect(to: string, flash?: string): Response;
};

export type Panel = {
  method: 'GET' | 'POST';
  pattern: RegExp;
  handle(ctx: Ctx): Promise<Response>;
};

const CORE_NAV: NavItem[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/tenants', label: 'Tenants' },
  { href: '/admin/items', label: 'Items' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/test', label: 'Test' },
  { href: '/admin/settings', label: 'Settings' },
];

export function nav(adapters: AdminAdapter[]): NavItem[] {
  return [
    ...CORE_NAV,
    ...adapters
      .filter((adapter) => adapter.admin)
      .map((adapter) => ({
        href: `/admin/${adapter.provider}`,
        label: adapter.provider,
        group: 'CRM adapters',
      })),
  ];
}

/** The navigation entry a path belongs to: the longest one it starts with. */
function current(path: string, items: NavItem[]): string {
  return (
    items
      .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? '/admin'
  );
}

export function renderer(
  request: Request,
  adapters: AdminAdapter[],
  user: string,
): (title: string, body: string, flash?: string | null) => Response {
  const items = nav(adapters);
  return (title, body, flash) => ({
    status: 200,
    headers: HTML,
    body: page({
      title,
      nav: items,
      current: current(request.path, items),
      user,
      body,
      flash: flash ?? request.query.get('flash'),
    }),
  });
}

export const redirect = (to: string, flash?: string): Response => ({
  status: 303,
  headers: { location: flash ? `${to}?flash=${encodeURIComponent(flash)}` : to },
});

/** Office ids typed into a form: separated by commas, spaces or newlines. */
export const officesOf = (text: string): string[] =>
  text
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
