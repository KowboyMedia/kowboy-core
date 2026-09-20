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

// ---- Vendored front-end assets, each served from node_modules under a versioned path so browsers
// may cache them for good and Core depends on no outside host. --------------------------------

type AssetFile = { path: string; type: string };
type Vendor = { base: string; root: string; files: Record<string, AssetFile> };

function vendor(slug: string, pkg: string, files: Record<string, AssetFile>): Vendor {
  const manifest = createRequire(import.meta.url).resolve(`${pkg}/package.json`);
  const { version } = JSON.parse(readFileSync(manifest, 'utf8')) as { version: string };
  return { base: `/admin/assets/${slug}/${version}`, root: dirname(manifest), files };
}

// Tabler, the admin UI kit on Bootstrap 5 (Patric, 2026-09-18).
const TABLER = vendor('tabler', '@tabler/core', {
  'tabler.min.css': { path: 'dist/css/tabler.min.css', type: 'text/css; charset=utf-8' },
  'tabler.min.js': { path: 'dist/js/tabler.min.js', type: 'text/javascript; charset=utf-8' },
});

// jsoneditor (josdejong), Apache-2.0: the market-leading component for showing JSON (Patric,
// 2026-09-19), used read-only for the panel's JSON blocks. Its CSS reaches an icon sprite at a
// relative img/ path, served here too.
const JSONEDITOR = vendor('jsoneditor', 'jsoneditor', {
  'jsoneditor.min.css': { path: 'dist/jsoneditor.min.css', type: 'text/css; charset=utf-8' },
  // The minimalist build: the read-only tree needs neither the code editor nor the validator.
  'jsoneditor.min.js': {
    path: 'dist/jsoneditor-minimalist.min.js',
    type: 'text/javascript; charset=utf-8',
  },
  'img/jsoneditor-icons.svg': { path: 'dist/img/jsoneditor-icons.svg', type: 'image/svg+xml' },
});

const loaded = new Map<string, string>();

function serve(v: Vendor): RouteTable[number] {
  return {
    method: 'GET',
    path: `${v.base}/*`,
    handler: async (request) => {
      const name = request.path.slice(v.base.length + 1);
      const file = v.files[name];
      if (!file) return { status: 404, body: { error: 'not found' } };
      const key = `${v.base}/${name}`;
      let body = loaded.get(key);
      if (body === undefined) {
        body = readFileSync(join(v.root, file.path), 'utf8');
        loaded.set(key, body);
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
  };
}

/** The vendored stylesheets and scripts, open to anyone: the login page needs Tabler too. */
export function assetRoutes(): RouteTable {
  return [serve(TABLER), serve(JSONEDITOR)];
}

/** The jsoneditor stylesheet and script, plus the one-off enhancer that turns every `.json-block`
 * on the page into a read-only viewer. Added only to pages that carry a JSON block. */
const jsonHead = `<link rel="stylesheet" href="${JSONEDITOR.base}/jsoneditor.min.css">`;
const jsonScript =
  `<script src="${JSONEDITOR.base}/jsoneditor.min.js"></script>` +
  `<script>(function(){if(typeof JSONEditor==='undefined')return;` +
  `document.querySelectorAll('.json-block').forEach(function(b){` +
  `var pre=b.querySelector('pre.json-fallback'),m=b.querySelector('.json-view');if(!pre||!m)return;` +
  `var data;try{data=JSON.parse(pre.textContent);}catch(e){return;}` +
  `try{new JSONEditor(m,{mode:'view',mainMenuBar:true,navigationBar:false,statusBar:false},data);` +
  `pre.hidden=true;m.hidden=false;}catch(e){}});})();</script>`;

// ---- The shell ---------------------------------------------------------------------------------

/** What Tabler leaves to us: the few names the panels use for state, and long JSON blocks. */
const STYLE = `
  .muted { color: var(--tblr-secondary); }
  .ok { color: var(--tblr-green); }
  .bad { color: var(--tblr-red); }
  pre { max-height: 34rem; overflow: auto; font-size: .8rem; }
  .json-view { height: 24rem; }
  details > summary { cursor: pointer; color: var(--tblr-primary); }
  .datagrid-content { overflow-wrap: anywhere; }
  td .badge { vertical-align: middle; }
  /* Live activity: the whole row carries the state; a row that just arrived slides in and glows. */
  @keyframes activity-in {
    from { opacity: 0; transform: translateY(-.4rem); box-shadow: inset 0 0 0 100vw rgba(245, 159, 0, .35); }
    to { opacity: 1; transform: none; box-shadow: inset 0 0 0 100vw rgba(245, 159, 0, 0); }
  }
  tr.activity-new > td { animation: activity-in 1.6s ease-out; }
  @media (prefers-reduced-motion: reduce) { tr.activity-new > td { animation: none; } }
  /* Charts are inline SVG that fills its card; figures use the same sans as everything else. */
  .chart svg { width: 100%; height: auto; display: block; }
  .chart-legend { display: flex; flex-wrap: wrap; gap: .25rem 1rem; font-size: .8rem; color: var(--tblr-secondary); margin-top: .5rem; }
  .chart-legend .key { display: inline-block; width: .75rem; height: .75rem; border-radius: 2px; vertical-align: -1px; margin-right: .35rem; }
  .chart .hit:hover { opacity: .85; }
  .sparkline { display: block; width: 100%; height: 2.5rem; margin-top: .5rem; }
  .figure { font-size: 1.75rem; font-weight: 600; line-height: 1.1; }
  .tabular { font-variant-numeric: tabular-nums; }
`;

const head = (title: string, extra = ''): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(title)} · Core admin</title><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="${TABLER.base}/tabler.min.css">${extra}<style>${STYLE}</style></head>`;

const script = `<script src="${TABLER.base}/tabler.min.js"></script>`;

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

/**
 * One full page: the sidebar with the navigation and who is logged in, then the body. The
 * `email_off` markers tell the platform's edge (Cloudflare in front of App Platform) to leave
 * email addresses alone: without them every address in a record or an event was rewritten into a
 * "[email protected]" link (Patric, 2026-09-20: remove the mask).
 */
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
  const needsJson = options.body.includes('json-block');
  return (
    head(options.title, needsJson ? jsonHead : '') +
    `<body><!--email_off--><div class="page">` +
    `<aside class="navbar navbar-vertical navbar-expand-lg" data-bs-theme="dark"><div class="container-fluid">` +
    `<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#sidebar-menu" aria-controls="sidebar-menu" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>` +
    `<div class="navbar-brand navbar-brand-autodark"><a href="/admin" class="text-reset text-decoration-none">Core admin</a></div>` +
    `<div class="collapse navbar-collapse" id="sidebar-menu"><ul class="navbar-nav pt-lg-3">${navigation(options.nav, options.current)}</ul>` +
    `<div class="mt-auto pt-4 pb-2 px-2 small text-secondary"><div class="text-truncate" title="${user}">${user}</div><form method="post" action="/admin/logout" class="mt-2"><button class="btn btn-outline-secondary btn-sm">Log out</button></form></div>` +
    `</div></div></aside>` +
    `<div class="page-wrapper"><div class="page-header d-print-none"><div class="container-xl"><div class="row g-2 align-items-center"><div class="col"><h2 class="page-title">${escape(options.title)}</h2></div></div></div></div>` +
    `<div class="page-body"><div class="container-xl">${flashOf(options.flash)}${options.body}</div></div>` +
    `<footer class="footer footer-transparent d-print-none"><div class="container-xl"><p class="text-secondary small mb-0">Times are Swedish time (${TIME_ZONE}); hover a time for the exact moment in UTC.</p></div></footer></div></div>${script}${needsJson ? jsonScript : ''}<!--/email_off--></body></html>`
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
    `<body class="d-flex flex-column"><!--email_off--><div class="page page-center"><div class="container container-tight py-4"><div class="text-center mb-4"><a href="/admin" class="navbar-brand navbar-brand-autodark">Core admin</a></div><div class="card card-md"><div class="card-body"><h2 class="h2 text-center mb-3">${escape(options.title)}</h2>${flashOf(options.flash)}${options.body}</div></div></div></div>${script}<!--/email_off--></body></html>`
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

/** A value shown as JSON in a plain `<pre>`. */
export const pre = (value: unknown): string =>
  `<pre>${escape(typeof value === 'string' ? value : JSON.stringify(value, null, 2))}</pre>`;

/**
 * A JSON value shown with the jsoneditor component (read-only), degrading to a `<pre>` when its
 * script has not loaded. The `<pre>` holds the canonical JSON: it is the single source the viewer
 * reads, and what a no-script reader sees. A page that has one of these loads the viewer's assets.
 */
export const json = (value: unknown): string =>
  `<div class="json-block"><pre class="json-fallback">${escape(
    typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  )}</pre><div class="json-view" hidden></div></div>`;

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

/**
 * The first moment of a calendar day in the panel's zone, as an ISO string: what a day typed into
 * a filter means, since the panel shows every time in Swedish time.
 */
export function startOfDay(day: string): string {
  const guess = new Date(`${day}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(guess);
  const part = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const local = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return new Date(guess.getTime() - (local - guess.getTime())).toISOString();
}

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
