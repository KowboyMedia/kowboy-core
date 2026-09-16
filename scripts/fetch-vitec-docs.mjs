// Fetches the Vitec Connect documentation Core is built against and saves it as the spec of
// record under docs/inputs/vitec/ (next-steps item 1): the advertising section with one page per
// endpoint, every model and enumeration those pages reach, its OpenAPI specification, the
// technical description (authentication, customer ids, security), the notifications (webhooks),
// the Extend API, previews and the migration notes.
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
  return response.text();
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
  if (name === 'span' && classes.includes('display1')) return 1;
  if (name === 'span' && classes.includes('headline')) return 2;
  if (name === 'span' && classes.includes('title')) return 3;
  return 0;
}

function toMarkdown(html) {
  const tokens = tokenize(html);
  const out = [];
  let text = '';
  const flush = () => {
    const line = text.replace(/[ \t\r\n]+/g, ' ').trim();
    if (line) out.push(line);
    text = '';
  };
  const stack = [];
  let dropDepth = 0;
  let pre = null;
  let table = null;
  let row = null;
  let link = null;
  let heading = 0;
  let listDepth = 0;

  for (const token of tokens) {
    if (token.type === 'text') {
      if (dropDepth > 0) continue;
      if (pre !== null) pre += token.text;
      else if (row !== null) row[row.length - 1] += token.text;
      else text += token.text;
      continue;
    }
    if (token.type === 'open') {
      const { name, attrs } = token;
      const classes = (attrs.class ?? '').split(/\s+/);
      const drop =
        DROP_TAGS.has(name) ||
        classes.some((c) => DROP_CLASSES.includes(c)) ||
        (attrs.id !== undefined && DROP_IDS.test(attrs.id));
      if (dropDepth > 0 || drop) {
        if (!token.selfClosing) {
          stack.push({ name, dropped: true });
          dropDepth += 1;
        }
        continue;
      }
      if (name === 'br') {
        if (pre !== null) pre += '\n';
        else if (row !== null) row[row.length - 1] += ' ';
        else text += '\n';
        continue;
      }
      if (token.selfClosing) continue;
      const level = headingLevel(name, attrs);
      if (level && pre === null && row === null) {
        flush();
        heading = level;
      } else if (name === 'pre') {
        flush();
        pre = '';
      } else if (name === 'table') {
        flush();
        table = [];
      } else if (name === 'tr' && table) {
        row = [];
      } else if ((name === 'td' || name === 'th') && row) {
        row.push('');
      } else if (name === 'a' && attrs.href && pre === null) {
        link = { href: attrs.href, start: row !== null ? row[row.length - 1].length : text.length };
      } else if (name === 'ul' || name === 'ol') {
        flush();
        listDepth += 1;
      } else if (name === 'li') {
        flush();
        text = `${'  '.repeat(listDepth - 1)}- `;
      } else if (BLOCK.has(name) && pre === null && row === null) {
        flush();
      }
      stack.push({
        name,
        level,
        dropped: false,
        isPre: name === 'pre',
        isTable: name === 'table',
        isList: name === 'ul' || name === 'ol',
      });
      continue;
    }
    // close
    let frame;
    do {
      frame = stack.pop();
    } while (
      frame &&
      frame.name !== token.name &&
      !frame.dropped &&
      stack.length > 0 &&
      stack.some((f) => f.name === token.name)
    );
    if (!frame) continue;
    if (frame.dropped) {
      dropDepth -= 1;
      continue;
    }
    if (frame.level && heading) {
      const line = text.replace(/\s+/g, ' ').trim();
      text = '';
      if (line) out.push(`${'#'.repeat(frame.level)} ${line}`);
      heading = 0;
    } else if (frame.isPre) {
      const code = pre.replace(/^\n+|\s+$/g, '');
      pre = null;
      if (code) out.push('```\n' + code + '\n```');
    } else if (frame.name === 'tr' && row) {
      table.push(row.map((cell) => cell.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')));
      row = null;
    } else if (frame.isTable) {
      const rows = table.filter((r) => r.some((c) => c));
      table = null;
      if (rows.length > 0) {
        const width = Math.max(...rows.map((r) => r.length));
        const pad = (r) => [...r, ...Array(width - r.length).fill('')];
        const [head, ...body] = rows.map(pad);
        out.push(
          [
            `| ${head.join(' | ')} |`,
            `| ${head.map(() => '---').join(' | ')} |`,
            ...body.map((r) => `| ${r.join(' | ')} |`),
          ].join('\n'),
        );
      }
    } else if (frame.name === 'a' && link) {
      const href = link.href.startsWith('http')
        ? link.href
        : link.href.startsWith('//')
          ? `https:${link.href}`
          : BASE + link.href;
      const wrap = (written) => {
        const label = written.slice(link.start).replace(/\s+/g, ' ').trim();
        return written.slice(0, link.start) + (label ? ` [${label}](${href}) ` : '');
      };
      if (row !== null) row[row.length - 1] = wrap(row[row.length - 1]);
      else text = wrap(text);
      link = null;
    } else if (frame.isList) {
      flush();
      listDepth -= 1;
    } else if (BLOCK.has(frame.name) && pre === null && row === null) {
      flush();
    }
  }
  flush();
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n';
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
  if (file === 'advertising.md') {
    const endpoints = [
      ...new Set([...html.matchAll(/href="(\/Help\/Api\/[^"]+)"/g)].map((m) => m[1])),
    ];
    for (const endpoint of endpoints) {
      const name = endpoint.replace('/Help/Api/', '');
      save(`api/${name}.md`, endpoint, await fetchText(endpoint));
      index.push([`api/${name}.md`, name.replace(/-/g, ' '), endpoint]);
    }
  }
}

// Every model the endpoints return, and every model and enumeration those reach in turn.
const crawled = new Set();
for (const link of modelLinks) {
  if (crawled.has(link)) continue;
  crawled.add(link);
  const name = new URL(BASE + link).searchParams.get('modelName');
  const dir = link.includes('EnumerationReference') ? 'enumerations' : 'models';
  save(`${dir}/${name}.md`, link, await fetchText(link));
  index.push([
    `${dir}/${name}.md`,
    `${dir === 'models' ? 'model' : 'enumeration'} ${name.replace(/^Advertising_|^Api_/, '')}`,
    link,
  ]);
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
].join('\n');
writeFileSync(join(OUT, 'README.md'), readme);
console.log(`${index.length} documents saved under ${OUT}`);
