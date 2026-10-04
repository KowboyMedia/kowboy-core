// Fetches the Vitec Connect documentation Core is built against and saves it as the spec of
// record under docs/inputs/vitec/ (next-steps item 1): the advertising section and the CRM contact
// category (the search profiles, docs/forms.md) with one page per endpoint, every model and
// enumeration those pages reach, the advertising OpenAPI specification, the technical description
// (authentication, customer ids, security), the notifications (webhooks), the Extend API, previews
// and the migration notes.
//
//   node scripts/fetch-vitec-docs.mjs
//   (behind a proxy that Node's fetch ignores, such as a cloud session's: NODE_USE_ENV_PROXY=1 node …)
//
// Pages are saved as Markdown, converted from the site's own HTML; the OpenAPI document is saved
// as JSON, pretty-printed. Nothing is edited by hand: run this again to refresh.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://connect.maklare.vitec.net';
const OUT = 'docs/inputs/vitec';

/** The pages besides the endpoints, and the file each becomes. */
const PAGES = [
  ['/Help/Section?id=advertising', 'advertising.md', 'The advertising section: every endpoint'],
  [
    '/Help/Category?version=v1&categoryId=CRM-Contact',
    'crm-contact.md',
    'The CRM contact category (version 1): contacts, search profiles, leads; every endpoint',
  ],
  [
    '/Help/TechnicalInformation',
    'technical-information.md',
    'Authentication, customer ids, security, error handling',
  ],
  ['/Help/NotificationsApi', 'notifications.md', 'Subscriptions and notifications (the webhooks)'],
  ['/Help/TermExtend', 'extend.md', 'The Extend API: the full model behind `extend`'],
  ['/Help/AdvertisingPreview', 'advertising-preview.md', 'Previews of estates'],
  ['/Help/AdvertisingMigration', 'advertising-migration.md', 'Migrating from version 1.0'],
];

const SPEC = ['/swagger/docs/advertising', 'advertising.openapi.json'];

async function fetchText(path) {
  const response = await fetch(BASE + path);
  if (!response.ok) throw new Error(`${path}: http ${response.status}`);
  return (await response.text()).replace(/\r\n?/g, '\n');
}

// --- HTML to Markdown, for this site's generated help pages -------------------------------------

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  auml: 'ä',
  ouml: 'ö',
  aring: 'å',
  Auml: 'Ä',
  Ouml: 'Ö',
  Aring: 'Å',
  eacute: 'é',
  uuml: 'ü',
};

const decode = (text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => ENTITIES[name] ?? match);

/** Elements whose whole subtree is noise here: navigation, forms, the try-it modals, code tabs. */
const DROP_TAGS = new Set(['script', 'style', 'head', 'header', 'button', 'img', 'i', 'svg']);
const DROP_CLASSES = ['navigation-area', 'modal', 'form-holder', 'list-holder', 'form-elements'];
const DROP_IDS = /^(curl-command|powershell|csharp|php|xml\d*)$/;

const BLOCK = new Set([
  'p',
  'div',
  'section',
  'article',
  'main',
  'body',
  'tr',
  'li',
  'ul',
  'ol',
  'table',
  'thead',
  'tbody',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'br',
]);

/** Elements that never have a closing tag, whether or not the page writes a slash. */
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function tokenize(html) {
  const cleaned = html
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  const tokens = [];
  const pattern = /<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:\s+[^>]*?)?)\s*(\/?)>|([^<]+)/g;
  let match;
  while ((match = pattern.exec(cleaned)) !== null) {
    if (match[1]) tokens.push({ type: 'close', name: match[1].toLowerCase() });
    else if (match[2]) {
      const attrs = {};
      for (const [, key, value] of match[3].matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g))
        attrs[key.toLowerCase()] = decode(value);
      const name = match[2].toLowerCase();
      tokens.push({ type: 'open', name, attrs, selfClosing: match[4] === '/' || VOID.has(name) });
    } else tokens.push({ type: 'text', text: decode(match[5]) });
  }
  return tokens;
}

function headingLevel(name, attrs) {
  if (/^h[1-4]$/.test(name)) return Number(name[1]);
  const classes = (attrs.class ?? '').split(/\s+/);
  if (name !== 'span') return 0;
  if (classes.includes('display1')) return 1;
  if (classes.includes('headline')) return 2;
  if (classes.includes('title')) return 3;
  return 0;
}

const isDropped = (name, attrs) =>
  DROP_TAGS.has(name) ||
  (attrs.class ?? '').split(/\s+/).some((c) => DROP_CLASSES.includes(c)) ||
  (attrs.id !== undefined && DROP_IDS.test(attrs.id));

const absolute = (href) =>
  href.startsWith('http') ? href : href.startsWith('//') ? `https:${href}` : BASE + href;

/** What the walk carries: finished blocks, the text being written, and where it is going. */
function newState() {
  return {
    out: [],
    text: '',
    stack: [],
    dropDepth: 0,
    pre: null,
    table: null,
    row: null,
    link: null,
    heading: 0,
    listDepth: 0,
  };
}

/** Finish the paragraph being written, if any. */
function flush(st) {
  const line = st.text.replace(/[ \t\r\n]+/g, ' ').trim();
  if (line) st.out.push(line);
  st.text = '';
}

/** Where a piece of text goes right now: a code block, a table cell, or the paragraph. */
function write(st, piece) {
  if (st.pre !== null) st.pre += piece;
  else if (st.row !== null) st.row[st.row.length - 1] += piece;
  else st.text += piece;
}

function onOpen(st, token) {
  const { name, attrs } = token;
  if (st.dropDepth > 0 || isDropped(name, attrs)) {
    if (!token.selfClosing) {
      st.stack.push({ name, dropped: true });
      st.dropDepth += 1;
    }
    return;
  }
  if (name === 'br') {
    write(st, st.row !== null ? ' ' : '\n');
    return;
  }
  if (token.selfClosing) return;
  const level = st.pre === null && st.row === null ? headingLevel(name, attrs) : 0;
  if (level) {
    flush(st);
    st.heading = level;
  } else if (!startStructure(st, name, attrs)) {
    startInline(st, name);
  }
  st.stack.push({ name, level, dropped: false });
}

/** Code blocks, tables and rows: the elements whose text is collected apart from paragraphs. */
function startStructure(st, name, attrs) {
  if (name === 'pre') {
    flush(st);
    st.pre = '';
  } else if (name === 'table') {
    flush(st);
    st.table = [];
  } else if (name === 'tr' && st.table) {
    st.row = [];
  } else if ((name === 'td' || name === 'th') && st.row) {
    st.row.push('');
  } else if (name === 'a' && attrs.href && st.pre === null) {
    st.link = {
      href: attrs.href,
      start: st.row !== null ? st.row[st.row.length - 1].length : st.text.length,
    };
  } else {
    return false;
  }
  return true;
}

/** Lists and other blocks: paragraph boundaries. */
function startInline(st, name) {
  if (name === 'ul' || name === 'ol') {
    flush(st);
    st.listDepth += 1;
  } else if (name === 'li') {
    flush(st);
    st.text = `${'  '.repeat(st.listDepth - 1)}- `;
  } else if (BLOCK.has(name) && st.pre === null && st.row === null) {
    flush(st);
  }
}

/** The frame a closing tag ends. A stray closing tag with no open frame is ignored. */
function popFrame(st, name) {
  let frame;
  do {
    frame = st.stack.pop();
  } while (frame && frame.name !== name && !frame.dropped && st.stack.some((f) => f.name === name));
  return frame;
}

function onClose(st, name) {
  const frame = popFrame(st, name);
  if (!frame) return;
  if (frame.dropped) st.dropDepth -= 1;
  else endElement(st, frame);
}

/** What ends with each closing tag. Anything else is a block boundary or nothing. */
const END = { pre: endPre, tr: endRow, table: endTable, a: endLink, ul: endList, ol: endList };

function endElement(st, frame) {
  if (frame.level && st.heading) return endHeading(st, frame.level);
  const end = END[frame.name];
  if (end) return end(st);
  if (BLOCK.has(frame.name) && st.pre === null && st.row === null) flush(st);
}

function endHeading(st, level) {
  const line = st.text.replace(/\s+/g, ' ').trim();
  st.text = '';
  if (line) st.out.push(`${'#'.repeat(level)} ${line}`);
  st.heading = 0;
}

function endPre(st) {
  if (st.pre === null) return;
  const code = st.pre.replace(/^\n+|\s+$/g, '');
  st.pre = null;
  if (code) st.out.push('```\n' + code + '\n```');
}

function endRow(st) {
  if (!st.row || !st.table) return;
  st.table.push(st.row.map((cell) => cell.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')));
  st.row = null;
}

function endTable(st) {
  if (!st.table) return;
  const rows = st.table.filter((r) => r.some((c) => c));
  st.table = null;
  if (rows.length === 0) return;
  const width = Math.max(...rows.map((r) => r.length));
  const [head, ...body] = rows.map((r) => [...r, ...Array(width - r.length).fill('')]);
  const line = (r) => `| ${r.join(' | ')} |`;
  st.out.push([line(head), line(head.map(() => '---')), ...body.map(line)].join('\n'));
}

/** The link wraps whatever was written since it opened, wherever that was going. */
function endLink(st) {
  if (!st.link) return;
  const href = absolute(st.link.href);
  const wrap = (written) => {
    const label = written.slice(st.link.start).replace(/\s+/g, ' ').trim();
    return written.slice(0, st.link.start) + (label ? ` [${label}](${href}) ` : '');
  };
  if (st.row !== null) st.row[st.row.length - 1] = wrap(st.row[st.row.length - 1]);
  else st.text = wrap(st.text);
  st.link = null;
}

function endList(st) {
  flush(st);
  st.listDepth -= 1;
}

function toMarkdown(html) {
  const st = newState();
  for (const token of tokenize(html)) {
    if (token.type === 'text') {
      if (st.dropDepth === 0) write(st, token.text);
    } else if (token.type === 'open') onOpen(st, token);
    else onClose(st, token.name);
  }
  flush(st);
  return st.out.join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

/** The generated pages put their content in one box; the rest is chrome. */
function content(html) {
  const start = html.indexOf('<div class="paper-content">');
  return start === -1 ? html : html.slice(start);
}

// --- the run -------------------------------------------------------------------------------------

for (const dir of ['api', 'models', 'enumerations']) mkdirSync(join(OUT, dir), { recursive: true });
const fetchedAt = new Date().toISOString().slice(0, 10);
const index = [];
/** Model and enumeration pages found on the way, crawled after the endpoints. */
const modelLinks = new Set();
/** Pages the site could not serve (it answers 500 for some), listed in the README, not fatal. */
const unavailable = [];

const save = (file, path, html) => {
  writeFileSync(
    join(OUT, file),
    `<!-- ${BASE}${path}, fetched ${fetchedAt} -->\n\n${toMarkdown(content(html))}`,
  );
  for (const [, link] of html.matchAll(
    /href="(\/Help\/(?:ResourceModel|EnumerationReference)\?modelName=[^"]+)"/g,
  )) {
    modelLinks.add(link.replace(/&amp;/g, '&'));
  }
};

for (const [path, file, what] of PAGES) {
  const html = await fetchText(path);
  save(file, path, html);
  index.push([file, what, path]);
  if (file === 'advertising.md' || file === 'crm-contact.md') {
    const endpoints = [
      ...new Set([...html.matchAll(/href="(\/Help\/Api\/[^"]+)"/g)].map((m) => m[1])),
    ];
    for (const endpoint of endpoints) {
      const name = endpoint.replace('/Help/Api/', '');
      let html;
      try {
        html = await fetchText(endpoint);
      } catch (error) {
        unavailable.push([endpoint, String(error.message)]);
        continue;
      }
      save(`api/${name}.md`, endpoint, html);
      index.push([`api/${name}.md`, name.replace(/-/g, ' '), endpoint]);
    }
  }
}

// Every model the endpoints return, and every model and enumeration those reach in turn. A page
// the site cannot serve (it answers 500 for some generic types) is listed, not fatal.
const crawled = new Set();
for (const link of modelLinks) {
  if (crawled.has(link)) continue;
  crawled.add(link);
  const name = new URL(BASE + link).searchParams.get('modelName');
  const dir = link.includes('EnumerationReference') ? 'enumerations' : 'models';
  let html;
  try {
    html = await fetchText(link);
  } catch (error) {
    unavailable.push([link, String(error.message)]);
    continue;
  }
  save(`${dir}/${name}.md`, link, html);
  const kind = dir === 'models' ? 'model' : 'enumeration';
  index.push([`${dir}/${name}.md`, `${kind} ${name.replace(/^Advertising_|^Api_/, '')}`, link]);
}

const spec = JSON.parse(await fetchText(SPEC[0]));
writeFileSync(join(OUT, SPEC[1]), JSON.stringify(spec, null, 2) + '\n');
index.push([
  SPEC[1],
  'OpenAPI 2.0 specification of the advertising API: every path, parameter and model',
  SPEC[0],
]);

const readme = [
  '# Vitec Connect documentation',
  '',
  `Fetched from ${BASE} on ${fetchedAt} by \`node scripts/fetch-vitec-docs.mjs\`. This is the spec of record for the`,
  'Vitec adapter (next-steps item 1): vendor documentation, saved as fetched, never edited by hand. Run the',
  'script again to refresh; the diff shows what Vitec changed.',
  '',
  '| File | What | Source |',
  '| --- | --- | --- |',
  ...index.map(([file, what, path]) => `| [${file}](${file}) | ${what} | ${path} |`),
  '',
  ...(unavailable.length > 0
    ? [
        'Pages the site could not serve when fetched:',
        '',
        ...unavailable.map(([link, why]) => `- ${link}: ${why}`),
        '',
      ]
    : []),
].join('\n');
writeFileSync(join(OUT, 'README.md'), readme);
console.log(`${index.length} documents saved under ${OUT}`);
