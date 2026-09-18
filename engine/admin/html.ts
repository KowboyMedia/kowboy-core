// The admin panel's HTML: a handful of template functions and one stylesheet, no framework
// (docs/admin-panel.md). Everything that came from data goes through `escape`.

export const escape = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );

export type NavItem = { href: string; label: string };

const STYLE = `
  :root { color-scheme: light; --line: #d9d9d9; --ink: #1b1b1b; --muted: #666; --accent: #1d4ed8; --bad: #b91c1c; --good: #15803d; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.45 system-ui, sans-serif; color: var(--ink); background: #fafafa; }
  header { display: flex; gap: 1.2rem; align-items: baseline; padding: .8rem 1.2rem; border-bottom: 1px solid var(--line); background: #fff; flex-wrap: wrap; }
  header strong { font-size: 1.05rem; margin-right: .6rem; }
  header a { color: var(--muted); text-decoration: none; }
  header a.current { color: var(--accent); font-weight: 600; }
  main { max-width: 1200px; margin: 0 auto; padding: 1.2rem; }
  h1 { font-size: 1.4rem; margin: .2rem 0 1rem; }
  h2 { font-size: 1.1rem; margin: 1.6rem 0 .6rem; }
  table { border-collapse: collapse; width: 100%; background: #fff; margin-bottom: 1rem; }
  th, td { text-align: left; padding: .4rem .6rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-weight: 600; color: var(--muted); font-size: .85rem; }
  pre { background: #fff; border: 1px solid var(--line); padding: .6rem; overflow: auto; max-height: 32rem; font-size: .82rem; margin: 0 0 1rem; }
  form { margin: 0 0 1rem; }
  form.inline { display: inline; margin: 0 .2rem 0 0; }
  label { display: block; margin: .5rem 0 .2rem; font-size: .9rem; color: var(--muted); }
  input[type=text], input[type=password], input[type=number], select, textarea { width: 100%; max-width: 40rem; padding: .35rem .5rem; border: 1px solid var(--line); border-radius: 3px; font: inherit; }
  button { padding: .35rem .8rem; border: 1px solid var(--accent); background: var(--accent); color: #fff; border-radius: 3px; font: inherit; cursor: pointer; margin-top: .4rem; }
  button.quiet { background: #fff; color: var(--accent); }
  .flash { padding: .6rem .8rem; border: 1px solid var(--good); background: #f0fdf4; margin-bottom: 1rem; }
  .flash.bad { border-color: var(--bad); background: #fef2f2; }
  .ok { color: var(--good); } .bad { color: var(--bad); }
  .columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); gap: 1rem; }
  .muted { color: var(--muted); }
  code { font-size: .85rem; }
`;

/** One full page: the header with the navigation, then the body. */
export function page(options: {
  title: string;
  nav: NavItem[];
  current: string;
  body: string;
  flash?: string | null;
}): string {
  const nav = options.nav
    .map(
      (item) =>
        `<a href="${escape(item.href)}"${item.href === options.current ? ' class="current"' : ''}>${escape(item.label)}</a>`,
    )
    .join('');
  const flash = options.flash
    ? `<div class="flash${options.flash.startsWith('!') ? ' bad' : ''}">${escape(options.flash.replace(/^!/, ''))}</div>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(options.title)} · Core admin</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${STYLE}</style></head><body><header><strong>Core admin</strong>${nav}<form class="inline" method="post" action="/admin/logout" style="margin-left:auto"><button class="quiet">Log out</button></form></header><main><h1>${escape(options.title)}</h1>${flash}${options.body}</main></body></html>`;
}

/** A table; the cells are HTML already, so escape data before putting it in. */
export function table(headers: string[], rows: string[][], empty = 'Nothing here.'): string {
  if (rows.length === 0) return `<p class="muted">${escape(empty)}</p>`;
  const head = headers.map((header) => `<th>${escape(header)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** A value shown as JSON. */
export const pre = (value: unknown): string =>
  `<pre>${escape(typeof value === 'string' ? value : JSON.stringify(value, null, 2))}</pre>`;

export function field(
  name: string,
  label: string,
  options: { type?: string; value?: string; placeholder?: string; required?: boolean } = {},
): string {
  const type = options.type ?? 'text';
  const attributes = [
    `type="${type}"`,
    `name="${escape(name)}"`,
    `id="${escape(name)}"`,
    options.value !== undefined ? `value="${escape(options.value)}"` : '',
    options.placeholder ? `placeholder="${escape(options.placeholder)}"` : '',
    options.required ? 'required' : '',
    type === 'password' ? 'autocomplete="off"' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<label for="${escape(name)}">${escape(label)}</label><input ${attributes}>`;
}

export function textarea(name: string, label: string, value = ''): string {
  return `<label for="${escape(name)}">${escape(label)}</label><textarea name="${escape(name)}" id="${escape(name)}" rows="3">${escape(value)}</textarea>`;
}

export function select(
  name: string,
  label: string,
  choices: { value: string; label?: string }[],
  selected?: string,
): string {
  const options = choices
    .map(
      (choice) =>
        `<option value="${escape(choice.value)}"${choice.value === selected ? ' selected' : ''}>${escape(choice.label ?? choice.value)}</option>`,
    )
    .join('');
  return `<label for="${escape(name)}">${escape(label)}</label><select name="${escape(name)}" id="${escape(name)}">${options}</select>`;
}

/** A POST form with the CSRF token; `inner` is HTML already. */
export function form(
  action: string,
  csrf: string,
  inner: string,
  options: { submit?: string; inline?: boolean; hidden?: Record<string, string> } = {},
): string {
  const hidden = Object.entries(options.hidden ?? {})
    .map(([name, value]) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`)
    .join('');
  return `<form method="post" action="${escape(action)}"${options.inline ? ' class="inline"' : ''}><input type="hidden" name="csrf" value="${escape(csrf)}">${hidden}${inner}<button${options.inline ? ' class="quiet"' : ''}>${escape(options.submit ?? 'Save')}</button></form>`;
}

export const link = (href: string, text: string): string =>
  `<a href="${escape(href)}">${escape(text)}</a>`;

export const when = (value: Date | string | null | undefined): string =>
  value
    ? escape(value instanceof Date ? value.toISOString() : value)
    : '<span class="muted">–</span>';

export const okBad = (ok: boolean, detail?: string | null): string =>
  `<span class="${ok ? 'ok' : 'bad'}">${ok ? 'ok' : 'failing'}</span>${detail ? ` <span class="muted">${escape(detail)}</span>` : ''}`;
