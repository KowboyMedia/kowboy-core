// The admin panel's HTML: a handful of template functions on top of Tabler, the open-source admin
// UI kit built on Bootstrap 5 (Patric, 2026-09-18: a market-leading component library, a
// professional look). Core serves Tabler's stylesheet and script itself, so the panel depends on
// no outside host. Everything that came from data goes through `escape`. Every page is a title,
// one line on what it is for, and cards that each say what they show or do.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { RouteTable } from '../http/server.js';

export const escape = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );

export type NavItem = { href: string; label: string; group?: string };

// ---- Tabler's files, served under a versioned path so browsers may cache them for good --------

const tabler = ((): { root: string; version: string } => {
  const manifest = createRequire(import.meta.url).resolve('@tabler/core/package.json');
  const { version } = JSON.parse(readFileSync(manifest, 'utf8')) as { version: string };
  return { root: dirname(manifest), version };
})();

const ASSETS = `/admin/assets/${tabler.version}`;
const ASSET_FILES: Record<string, { path: string; type: string }> = {
  'tabler.min.css': { path: 'dist/css/tabler.min.css', type: 'text/css; charset=utf-8' },
  'tabler.min.js': { path: 'dist/js/tabler.min.js', type: 'text/javascript; charset=utf-8' },
};
const loaded = new Map<string, string>();

/** The stylesheet and the script, open to anyone: the login page needs them too. */
export function assetRoutes(): RouteTable {
  return [
    {
      method: 'GET',
      path: `${ASSETS}/*`,
      handler: async (request) => {
        const name = request.path.slice(ASSETS.length + 1);
        const file = ASSET_FILES[name];
        if (!file) return { status: 404, body: { error: 'not found' } };
        let body = loaded.get(name);
        if (body === undefined) {
          body = readFileSync(join(tabler.root, file.path), 'utf8');
          loaded.set(name, body);
        }
        return {
          status: 200,
          headers: {
            'content-type': file.type,
            'cache-control': 'public, max-age=31536000, immutable',
          },
          body,
        };
      },
    },
  ];
}

// ---- The shell ---------------------------------------------------------------------------------

/** What Tabler leaves to us: the few names the panels use for state, and long JSON blocks. */
const STYLE = `
  .muted { color: var(--tblr-secondary); }
  .ok { color: var(--tblr-green); }
  .bad { color: var(--tblr-red); }
  pre { max-height: 34rem; overflow: auto; font-size: .8rem; }
  details > summary { cursor: pointer; color: var(--tblr-primary); }
  .datagrid-content { overflow-wrap: anywhere; }
  td .badge { vertical-align: middle; }
`;

const head = (title: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(title)} · Core admin</title><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="${ASSETS}/tabler.min.css"><style>${STYLE}</style></head>`;

const script = `<script src="${ASSETS}/tabler.min.js"></script>`;

const flashOf = (flash: string | null | undefined): string =>
  flash
    ? `<div class="alert ${flash.startsWith('!') ? 'alert-danger' : 'alert-success'}" role="alert">${escape(flash.replace(/^!/, ''))}</div>`
    : '';

/** The navigation links, with a group label wherever the group changes. */
function navigation(items: NavItem[], current: string): string {
  let group: string | undefined;
  return items
    .map((item) => {
      const label =
        item.group && item.group !== group
          ? `<li class="nav-item mt-3"><span class="nav-link disabled text-uppercase small fw-bold">${escape(item.group)}</span></li>`
          : '';
      group = item.group;
      return `${label}<li class="nav-item${item.href === current ? ' active' : ''}"><a class="nav-link" href="${escape(item.href)}"><span class="nav-link-title">${escape(item.label)}</span></a></li>`;
    })
    .join('');
}

/** One full page: the sidebar with the navigation and who is logged in, then the body. */
export function page(options: {
  title: string;
  nav: NavItem[];
  current: string;
  /** The address logged in, shown next to the logout button. */
  user?: string;
  body: string;
  flash?: string | null;
}): string {
  const user = escape(options.user ?? '');
  return (
    head(options.title) +
    `<body><div class="page">` +
    `<aside class="navbar navbar-vertical navbar-expand-lg" data-bs-theme="dark"><div class="container-fluid">` +
    `<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#sidebar-menu" aria-controls="sidebar-menu" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>` +
    `<div class="navbar-brand navbar-brand-autodark"><a href="/admin" class="text-reset text-decoration-none">Core admin</a></div>` +
    `<div class="collapse navbar-collapse" id="sidebar-menu"><ul class="navbar-nav pt-lg-3">${navigation(options.nav, options.current)}</ul>` +
    `<div class="mt-auto pt-4 pb-2 px-2 small text-secondary"><div class="text-truncate" title="${user}">${user}</div><form method="post" action="/admin/logout" class="mt-2"><button class="btn btn-outline-secondary btn-sm">Log out</button></form></div>` +
    `</div></div></aside>` +
    `<div class="page-wrapper"><div class="page-header d-print-none"><div class="container-xl"><div class="row g-2 align-items-center"><div class="col"><h2 class="page-title">${escape(options.title)}</h2></div></div></div></div>` +
    `<div class="page-body"><div class="container-xl">${flashOf(options.flash)}${options.body}</div></div>` +
    `<footer class="footer footer-transparent d-print-none"><div class="container-xl"><p class="text-secondary small mb-0">Times are Swedish time (${TIME_ZONE}); hover a time for the exact moment in UTC.</p></div></footer></div></div>${script}</body></html>`
  );
}

/** A page outside the shell, one card in the middle: the login. */
export function standalone(options: {
  title: string;
  body: string;
  flash?: string | null;
}): string {
  return (
    head(options.title) +
    `<body class="d-flex flex-column"><div class="page page-center"><div class="container container-tight py-4"><div class="text-center mb-4"><a href="/admin" class="navbar-brand navbar-brand-autodark">Core admin</a></div><div class="card card-md"><div class="card-body"><h2 class="h2 text-center mb-3">${escape(options.title)}</h2>${flashOf(options.flash)}${options.body}</div></div></div></div>${script}</body></html>`
  );
}

// ---- Blocks ------------------------------------------------------------------------------------

/** The one line under a page title saying what the page is for. */
export const intro = (text: string): string => `<p class="text-secondary mb-4">${escape(text)}</p>`;

/** A card: a heading, one line on what it shows or does, and its content (HTML already). */
export function card(title: string, help: string, inner: string): string {
  return `<div class="card mb-3"><div class="card-header"><div><h3 class="card-title">${escape(title)}</h3>${help ? `<p class="card-subtitle">${escape(help)}</p>` : ''}</div></div><div class="card-body">${inner}</div></div>`;
}

/** Cards side by side on a wide screen, one under another on a narrow one. */
export const grid = (items: string[]): string =>
  `<div class="row row-cards">${items
    .map(
      (item) =>
        `<div class="col-md-6 col-xl-4 d-flex">${item.replace('class="card mb-3"', 'class="card mb-3 flex-fill"')}</div>`,
    )
    .join('')}</div>`;

/** A table; the cells are HTML already, so escape data before putting it in. */
export function table(headers: string[], rows: string[][], empty = 'Nothing here.'): string {
  if (rows.length === 0) return `<p class="text-secondary mb-0">${escape(empty)}</p>`;
  const head = headers.map((header) => `<th>${escape(header)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="table-responsive"><table class="table table-vcenter"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** Key and value pairs; the values are HTML already. */
export function kv(pairs: [string, string][]): string {
  return `<div class="datagrid">${pairs
    .map(
      ([key, value]) =>
        `<div class="datagrid-item"><div class="datagrid-title">${escape(key)}</div><div class="datagrid-content">${value}</div></div>`,
    )
    .join('')}</div>`;
}

/** A value shown as JSON. */
export const pre = (value: unknown): string =>
  `<pre>${escape(typeof value === 'string' ? value : JSON.stringify(value, null, 2))}</pre>`;

const BADGE: Record<'ok' | 'bad' | 'muted', string> = {
  ok: 'bg-green-lt',
  bad: 'bg-red-lt',
  muted: 'bg-secondary-lt',
};

/** A state word in a coloured badge. */
export const pill = (state: 'ok' | 'bad' | 'muted', text: string): string =>
  `<span class="badge ${BADGE[state]}">${escape(text)}</span>`;

export const yesNo = (value: boolean): string => pill(value ? 'ok' : 'muted', value ? 'yes' : 'no');

const hint = (help?: string): string =>
  help ? `<small class="form-hint">${escape(help)}</small>` : '';

export function field(
  name: string,
  label: string,
  options: {
    type?: string;
    value?: string;
    placeholder?: string;
    required?: boolean;
    /** One line under the field on what goes in it. */
    help?: string;
  } = {},
): string {
  const type = options.type ?? 'text';
  const attributes = [
    `type="${type}"`,
    'class="form-control"',
    `name="${escape(name)}"`,
    `id="${escape(name)}"`,
    options.value !== undefined ? `value="${escape(options.value)}"` : '',
    options.placeholder ? `placeholder="${escape(options.placeholder)}"` : '',
    options.required ? 'required' : '',
    type === 'password' ? 'autocomplete="off"' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<div class="mb-3"><label class="form-label" for="${escape(name)}">${escape(label)}</label><input ${attributes}>${hint(options.help)}</div>`;
}

export function textarea(name: string, label: string, value = '', help?: string): string {
  return `<div class="mb-3"><label class="form-label" for="${escape(name)}">${escape(label)}</label><textarea class="form-control" name="${escape(name)}" id="${escape(name)}" rows="3">${escape(value)}</textarea>${hint(help)}</div>`;
}

export function select(
  name: string,
  label: string,
  choices: { value: string; label?: string }[],
  selected?: string,
  help?: string,
): string {
  const options = choices
    .map(
      (choice) =>
        `<option value="${escape(choice.value)}"${choice.value === selected ? ' selected' : ''}>${escape(choice.label ?? choice.value)}</option>`,
    )
    .join('');
  return `<div class="mb-3"><label class="form-label" for="${escape(name)}">${escape(label)}</label><select class="form-select" name="${escape(name)}" id="${escape(name)}">${options}</select>${hint(help)}</div>`;
}

/**
 * A POST form with the CSRF token; `inner` is HTML already. One rule for every button on the
 * panel (Patric, 2026-09-19): a card's own action is a blue button, a secondary action next to
 * other things is a small outlined one, a removal is a red outlined one, and a row's actions sit
 * in one menu.
 */
export function form(
  action: string,
  csrf: string,
  inner: string,
  options: {
    submit?: string;
    /** A small outlined button that sits next to others. */
    inline?: boolean;
    /** An entry in a row's actions menu (see `menu`). */
    menu?: boolean;
    hidden?: Record<string, string>;
    /** A red button: it removes or replaces something. */
    danger?: boolean;
  } = {},
): string {
  const hidden = Object.entries(options.hidden ?? {})
    .map(([name, value]) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`)
    .join('');
  const button = options.menu
    ? 'dropdown-item'
    : options.danger
      ? 'btn btn-outline-danger'
      : options.inline
        ? 'btn btn-outline-secondary btn-sm'
        : 'btn btn-primary';
  const shape = options.inline ? ' class="d-inline-block me-1 mb-1"' : '';
  return `<form method="post" action="${escape(action)}"${shape}><input type="hidden" name="csrf" value="${escape(csrf)}">${hidden}${inner}<button class="${button}">${escape(options.submit ?? 'Save')}</button></form>`;
}

export const link = (href: string, text: string): string =>
  `<a href="${escape(href)}">${escape(text)}</a>`;

/** Every time on the panel is shown in Swedish time; the exact moment in UTC sits in the tooltip. */
export const TIME_ZONE = 'Europe/Stockholm';

const clock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** A moment as `2026-09-18 22:14:05` in Swedish time; a value that is not a date stays as it is. */
export const stamp = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : clock.format(date);
};

export const when = (value: Date | string | null | undefined): string => {
  if (!value) return '<span class="text-secondary">–</span>';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    return `<span class="text-nowrap">${escape(String(value))}</span>`;
  const iso = date.toISOString();
  return `<time class="text-nowrap" datetime="${iso}" title="${iso}">${stamp(date)}</time>`;
};

/** A row's actions in one small menu; the items are forms with `menu: true`, or links with `dropdown-item`. */
export const menu = (label: string, items: string[]): string =>
  `<div class="dropdown"><button class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">${escape(label)}</button><div class="dropdown-menu">${items.join('')}</div></div>`;

/** A section folded under its title, for a form that is used now and then. */
export const details = (summary: string, inner: string): string =>
  `<details class="mt-3"><summary class="fw-bold">${escape(summary)}</summary><div class="mt-3">${inner}</div></details>`;

export const okBad = (ok: boolean, detail?: string | null): string =>
  pill(ok ? 'ok' : 'bad', ok ? 'ok' : 'failing') +
  (detail ? ` <span class="text-secondary">${escape(detail)}</span>` : '');
