// The pure part of the report: reading sitemaps and Lighthouse results, deciding which claims the
// measurements carry, and filling the template. report.mjs does the network and the browser.

/** Statuses in a home's address (objekt/<status>-…) whose page the site shows publicly. */
const PUBLIC_STATUSES = ['till-salu', 'kommande', 'sold', 'sald', 'salda'];
const ALL_STATUSES = [
  ...PUBLIC_STATUSES,
  'ej-till-salu',
  'atertagen',
  'vilande',
  'uppdrag',
  'undefined',
];

export function parseArgs(argv) {
  const options = {
    crm: 'Vitec',
    runs: 3,
    list: '/till-salu/',
    date: new Date().toISOString().slice(0, 10),
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    options[key] = key === 'runs' ? Number(argv[i + 1]) : argv[i + 1];
  }
  // --from re-renders a report from the facts a run saved, so it needs no sites.
  for (const required of options.from ? ['out'] : ['ours', 'theirs', 'out']) {
    if (!options[required]) throw new Error(`--${required} is required`);
  }
  for (const site of ['ours', 'theirs']) options[site] = options[site]?.replace(/\/$/, '');
  return options;
}

export function median(values) {
  const sorted = values.filter((v) => typeof v === 'number').sort((a, b) => a - b);
  return sorted.length === 0 ? null : sorted[Math.floor((sorted.length - 1) / 2)];
}

/** The last part of an address's final segment: the record's id, the same on any site fed from one CRM. */
export function idOf(url) {
  const slug = new URL(url).pathname.replace(/\/$/, '').split('/').pop() ?? '';
  return slug.slice(slug.lastIndexOf('-') + 1).toLowerCase();
}

export function statusOf(url) {
  const slug = new URL(url).pathname.replace(/^\/objekt\//, '');
  return (
    ALL_STATUSES.filter((s) => slug.startsWith(`${s}-`)).sort((a, b) => b.length - a.length)[0] ??
    'other'
  );
}

/** What a Core site's sitemap lists, by the Swedish paths its plugin gives each kind of record. */
export function countSitemap(urls) {
  const under = (path) =>
    urls.filter((u) => new URL(u).pathname.startsWith(path) && new URL(u).pathname !== path);
  const homes = under('/objekt/');
  const byStatus = (statuses) => homes.filter((u) => statuses.includes(statusOf(u))).length;
  return {
    homes: byStatus(PUBLIC_STATUSES),
    forSale: byStatus(['till-salu']),
    coming: byStatus(['kommande']),
    sold: byStatus(['sold', 'sald', 'salda']),
    areas: under('/omrade/').length,
    associations: under('/forening/').length,
    agents: under('/maklare/').length,
    offices: under('/kontor/').length,
  };
}

/** Homes for sale on our site that the other site lists too (same id), in our sitemap's order. */
export function matchedHomes(ourUrls, theirUrls) {
  const theirs = new Map(theirUrls.map((u) => [idOf(u), u]));
  return ourUrls
    .filter((u) => statusOf(u) === 'till-salu' && theirs.has(idOf(u)))
    .map((u) => ({ ours: u, theirs: theirs.get(idOf(u)) }));
}

/** The area page whose address starts like the home's (municipality, then area), else the first. */
export function areaFor(homeUrl, areaUrls) {
  const rest = new URL(homeUrl).pathname.replace(/^\/objekt\/[a-z-]*?(till-salu|kommande)-/, '');
  const prefix = (u) => new URL(u).pathname.replace(/^\/omrade\//, '').replace(/-[^-]+\/?$/, '');
  const matches = areaUrls.filter((u) => rest.startsWith(`${prefix(u)}-`));
  return matches.sort((a, b) => prefix(b).length - prefix(a).length)[0] ?? areaUrls[0] ?? null;
}

/** Lighthouse's search score with some checks left out (a preview's deliberate block on search engines). */
export function seoScore(lhr, leaveOut = []) {
  const refs = lhr.categories.seo.auditRefs.filter((r) => r.weight > 0 && !leaveOut.includes(r.id));
  const scored = refs.filter((r) => typeof lhr.audits[r.id]?.score === 'number');
  const weight = scored.reduce((sum, r) => sum + r.weight, 0);
  return weight === 0
    ? null
    : Math.round(
        (100 * scored.reduce((sum, r) => sum + r.weight * lhr.audits[r.id].score, 0)) / weight,
      );
}

/** The middle of each number over the runs of one page. */
export function summarize(lhrs, leaveOut = []) {
  const pick = (f) => median(lhrs.map(f));
  return {
    lcp: pick((r) => r.audits['largest-contentful-paint']?.numericValue / 1000),
    cls: pick((r) => r.audits['cumulative-layout-shift']?.numericValue),
    perf: pick((r) => Math.round(r.categories.performance.score * 100)),
    a11y: pick((r) => Math.round(r.categories.accessibility.score * 100)),
    seo: pick((r) => seoScore(r, leaveOut)),
  };
}

export function possessive(name) {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
export const numberWord = (n) => WORDS[n] ?? String(n);

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

const seconds = (s) => `${s.toFixed(1)} s`;

/** The phone speed chart: one pair of bars per page, today's site in grey and ours in green. */
export function chartSvg(rows) {
  const top = Math.max(4, ...rows.flatMap((r) => [r.today, r.next]));
  const step = top > 20 ? 5 : 2;
  const max = Math.ceil(top / step) * step;
  const x = (s) => 130 + (540 * s) / max;
  const height = 60 + rows.length * 48;
  const axis = height - 28;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const grid = ticks
    .slice(1)
    .map((t) => `<line x1="${x(t)}" y1="28" x2="${x(t)}" y2="${axis}"/>`)
    .join('');
  const labels = ticks.map((t) => `<text x="${x(t)}" y="${axis + 16}">${t} s</text>`).join('');
  const bars = rows
    .map((r, i) => {
      const y = 46 + i * 48;
      return [
        `<text x="0" y="${y + 20}" font-size="13" font-weight="600" fill="#1c1f1d">${escapeHtml(r.label)}</text>`,
        `<rect x="130" y="${y}" width="${x(r.today) - 130}" height="14" rx="3" fill="#b9bfba"/>`,
        `<text x="${x(r.today) + 6}" y="${y + 11.5}" font-size="12" fill="#5d6460">${seconds(r.today)}</text>`,
        `<rect x="130" y="${y + 17}" width="${x(r.next) - 130}" height="14" rx="3" fill="#2e5b4f"/>`,
        `<text x="${x(r.next) + 6}" y="${y + 28.5}" font-size="12" font-weight="600" fill="#2e5b4f" stroke="#ffffff" stroke-width="4" paint-order="stroke">${seconds(r.next)}</text>`,
      ].join('');
    })
    .join('');
  const aria = rows
    .map((r) => `${r.label}: today ${seconds(r.today)}, next generation ${seconds(r.next)}`)
    .join('. ');
  return `<svg viewBox="0 0 688 ${height}" role="img" aria-label="${escapeHtml(aria)}. Google's mark for good is 2.5 s.">
<rect x="0" y="3" width="11" height="11" rx="2" fill="#b9bfba"/><text x="17" y="13" font-size="12" fill="#5d6460">Today's site</text>
<rect x="104" y="3" width="11" height="11" rx="2" fill="#2e5b4f"/><text x="121" y="13" font-size="12" fill="#5d6460">Next generation</text>
<g stroke="#e4e7e3" stroke-width="1">${grid}</g>
<line x1="${x(2.5)}" y1="28" x2="${x(2.5)}" y2="${axis}" stroke="#2e5b4f" stroke-width="1.5" stroke-dasharray="4 3"/>
<text x="${x(2.5) + 4.5}" y="38" font-size="11" fill="#2e5b4f">Google's mark for good: 2.5 s</text>
${bars}
<line x1="130" y1="${axis}" x2="670" y2="${axis}" stroke="#5d6460" stroke-width="1"/><line x1="130" y1="28" x2="130" y2="${axis}" stroke="#5d6460" stroke-width="1"/>
<g font-size="11" fill="#5d6460" text-anchor="middle">${labels}</g>
</svg>`;
}

/** Joins phrases as the approved report does: "a", "a and b", "a, b, and c". */
export function prose(items, word = 'and') {
  if (items.length < 3) return items.join(` ${word} `);
  return `${items.slice(0, -1).join(', ')}, ${word} ${items.at(-1)}`;
}

/**
 * Fills the template: `{{name}}` escaped, `{{{name}}}` as HTML, and `<!--if:name-->…<!--end:name-->`
 * kept only when the value is truthy, so a claim the measurements do not carry never prints.
 */
export function render(template, model) {
  let kept = template;
  for (let before = ''; before !== kept;) {
    before = kept;
    kept = kept.replace(/<!--if:(\w+)-->([\s\S]*?)<!--end:\1-->/g, (_, name, body) =>
      model[name] ? body : '',
    );
  }
  const filled = kept
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, name) => String(model[name] ?? ''))
    .replace(/\{\{(\w+)\}\}/g, (_, name) => escapeHtml(model[name] ?? ''));
  const left = filled.match(/\{\{[^}]*\}\}|<!--(if|end):\w+-->/);
  if (left) throw new Error(`template left unfilled: ${left[0]}`);
  return filled;
}

// The named entities WordPress writes in Swedish texts; anything else comes as a number.
const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  aring: 'å',
  auml: 'ä',
  ouml: 'ö',
  Aring: 'Å',
  Auml: 'Ä',
  Ouml: 'Ö',
  eacute: 'é',
  uuml: 'ü',
};

/** Turns HTML entities back into text: named ones, and numbers in decimal or hex. */
export function decode(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code) => {
    if (code[0] !== '#') return ENTITIES[code] ?? whole;
    return String.fromCodePoint(
      code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)),
    );
  });
}

/** A page's meta tags by name or property, first one wins, quotes of either kind. */
export function metas(html) {
  const found = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = tag.match(/\b(?:name|property)=(["'])(.*?)\1/i)?.[2];
    const content = tag.match(/\bcontent=(["'])(.*?)\1/is)?.[2];
    if (key && content !== undefined && !(key in found)) found[key] = decode(content);
  }
  return found;
}

/** What the report needs from a home's page on a Core site (the Kowboy theme's markup). */
export function readHome(html) {
  const hero = html.match(
    /<p class="k-label[^"]*">([^<]*)<\/p>\s*<h1 class="k-hero__title[^"]*">([^<]*)</,
  );
  const meta = metas(html);
  return {
    area: decode(hero?.[1] ?? '').trim(),
    street: decode(hero?.[2] ?? '').trim(),
    hasViewing: html.includes('Boka här'),
    description: (meta.description ?? '').trim(),
    ogImage: meta['og:image'] ?? null,
    headings: (html.match(/<h[1-6][\s>]/gi) ?? []).length,
    hasMap: html.includes('k-map'),
  };
}

/** The ways in that a Core site's page offers, read from its text and form fields. */
export function formFeatures(html) {
  return {
    valuation: /Boka fri värdering/i.test(html),
    interest: /Anmäl intresse/i.test(html),
    searchProfile: /Söker du bostad/i.test(html),
    autocomplete: ['given-name', 'family-name', 'tel', 'email'].every((a) =>
      html.includes(`autocomplete="${a}"`),
    ),
    chat: html.includes('kowboy-chat'),
    humanKey: html.match(/data-human-key="([^"]+)"/)?.[1] ?? null,
  };
}

/** The distinct home pages a list links to, in the HTML as the server sends it. */
export function homeLinks(html) {
  return new Set([...html.matchAll(/href="([^"]*\/objekt\/[^"#?]+)"/g)].map((m) => m[1]));
}

export function canonicalOf(html) {
  return decode(
    html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? '',
  );
}

/** "a", "a or b", "a, b, or c". */
export const orList = (items) => prose(items, 'or');

const BETTER = [
  ['lcp', 'shows its main content sooner', (t, o) => t < o, (v) => `${v.toFixed(1)} s`],
  ['cls', 'moves less while loading', (t, o) => t < o, (v) => v.toFixed(2)],
  ['perf', "scores higher in Google's speed test", (t, o) => t > o, String],
  ['a11y', "scores higher in Google's accessibility test", (t, o) => t > o, String],
  ['seo', "scores higher in Google's search check", (t, o) => t > o, String],
];

/** Where today's site measures better, for the person sending the report, never for the report. */
export function theirsBetter(speed) {
  return ['home', 'property'].flatMap((page) =>
    BETTER.filter(([key, , better]) => better(speed.theirs[page][key], speed.ours[page][key])).map(
      ([key, what, , show]) =>
        `${page === 'home' ? 'Home page' : "A home's page"}: today's site ${what} (${show(speed.theirs[page][key])} against ${show(speed.ours[page][key])}).`,
    ),
  );
}
