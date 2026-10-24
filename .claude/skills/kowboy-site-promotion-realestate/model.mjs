// Turns the facts report.mjs measured into the report's words. Every claim is printed only when a
// measurement or a check on the live site carries it; the rest is left out, never softened.

import { chartSvg, escapeHtml, numberWord, orList, possessive, prose } from './lib.mjs';

const all = (...conditions) => conditions.every(Boolean);
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const fmt = (s) => s.toFixed(1);

function longDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function monthYear(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Which pages our site shows faster on a phone than today's site; only those get a pair of bars. */
function speedRows(speed) {
  return [
    { label: 'Home page', today: speed.theirs.home.lcp, next: speed.ours.home.lcp },
    { label: "A home's page", today: speed.theirs.property.lcp, next: speed.ours.property.lcp },
  ].filter((r) => typeof r.next === 'number' && typeof r.today === 'number' && r.next < r.today);
}

function flags(f) {
  const ours = f.speed.ours;
  return {
    fast: all(ours.home.lcp <= 2.5, speedRows(f.speed).length > 0),
    still: ours.property.cls <= 0.1,
    readable: all(f.list.links > 0, f.home.headings > 0),
    morePages: f.counts.associations + f.counts.areas > 0,
    forms: [f.features.valuation, f.features.interest, f.features.viewing].some(Boolean),
    accessible: ours.home.a11y >= 90,
  };
}

function tile(big, unit, text) {
  return `<div class="tile"><b>${escapeHtml(big)}${unit ? ` <small>${unit}</small>` : ''}</b><span>${escapeHtml(text)}</span></div>`;
}

function tiles(f, k) {
  const ours = f.speed.ours;
  const list = [
    [
      ours.home.lcp <= 2.5,
      fmt(ours.home.lcp),
      's',
      'until the home page shows on a phone. Google counts up to 2.5 seconds as good.',
    ],
    [
      ours.home.perf >= 90,
      ours.home.perf,
      '/ 100',
      "in Google's speed test for the home page on a phone.",
    ],
    [
      all(f.counts.associations > 0, !f.theirsHasAssociations),
      f.counts.associations,
      '',
      `new pages, one for each housing association in ${k.brandPos} records.`,
    ],
    [
      k.accessible,
      ours.home.a11y,
      '/ 100',
      "in Google's accessibility test, so the site works for every visitor.",
    ],
    [
      k.still,
      ours.property.cls.toFixed(2),
      '',
      "layout shift while a home's page loads, so nothing jumps. Google counts up to 0.1 as good.",
    ],
    [
      all(f.counts.areas > 0, f.areaPage.hasMap),
      f.counts.areas,
      '',
      'area pages, each with its outline on a map and its homes.',
    ],
  ].filter(([show]) => show);
  const html = list.map(([, big, unit, text]) => tile(big, unit, text));
  // An odd last tile spans both columns, so the grid never leaves a hole.
  if (html.length % 2 === 1)
    html[html.length - 1] = html.at(-1).replace('class="tile"', 'class="tile span"');
  return html.join('\n');
}

function waysIn(f) {
  return [
    [f.features.valuation, 'a free valuation on every page'],
    [f.features.interest, 'interest on every home'],
    [f.features.viewing, 'booking a chosen viewing time'],
  ]
    .filter(([show]) => show)
    .map(([, text]) => text);
}

function contactTile(f, k) {
  const ways = waysIn(f);
  if (ways.length === 0) return '';
  const word = `${numberWord(ways.length)} ${ways.length === 1 ? 'way' : 'ways'} to get in touch`;
  const profile = f.features.searchProfile
    ? ` Every form can also save the visitor's home search in ${k.crm}.`
    : '';
  return `<div class="tile wide"><span><strong>${word},</strong> each where it belongs: ${escapeHtml(prose(ways))}.${escapeHtml(profile)}</span></div>`;
}

function lead(k) {
  const phrases = [
    [k.fast, 'faster on phones'],
    [k.readable, 'easier to find in Google and AI assistants'],
    [k.morePages, 'more pages that bring buyers in'],
    [k.forms, 'forms that turn more visits into leads'],
  ]
    .filter(([show]) => show)
    .map(([, text]) => text);
  const start = `Today's site brings ${k.brandPos} homes, agents and areas from ${k.crm} to buyers every day. The next generation keeps all of that and builds on it`;
  return phrases.length === 0
    ? `${escapeHtml(start)}.`
    : `${escapeHtml(start)}: <strong>${escapeHtml(prose(phrases))}.</strong>`;
}

const CHECK =
  '<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="#2e5b4f"/><path d="M5 9.2l2.6 2.5L13 6.4" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function keepItems(f, k) {
  const items = [
    `Every home, agent, area and office from ${k.crm}, as today.`,
    all(f.addresses.checked > 0, f.addresses.kept === f.addresses.checked)
      ? `The same web addresses for every home and agent that ${k.crm} lists for the site.`
      : '',
    `${k.brandPos} name, logo and texts.`,
    'Kowboy as the partner behind the site, and for the move.',
  ].filter(Boolean);
  return {
    keepCount: items.length,
    keepHtml: items.map((t) => `<li>${CHECK}<span>${escapeHtml(t)}</span></li>`).join('\n'),
  };
}

const ICONS = {
  fast: '<path d="M16.5 6.5L9.5 16.5h5l-1.5 7 7-10h-5l1.5-7z" fill="#2e5b4f"/>',
  search:
    '<circle cx="13.5" cy="13.5" r="5.5" fill="none" stroke="#2e5b4f" stroke-width="2"/><path d="M17.6 17.6l4.6 4.6" stroke="#2e5b4f" stroke-width="2.2" stroke-linecap="round"/>',
  building:
    '<path d="M9 22V10.5l6-3.5 6 3.5V22" fill="none" stroke="#2e5b4f" stroke-width="2" stroke-linejoin="round"/><path d="M12.5 13h1.5M16 13h1.5M12.5 16.5h1.5M16 16.5h1.5M13.5 22v-2.5h3V22" fill="none" stroke="#2e5b4f" stroke-width="1.8"/>',
  form: '<rect x="8.5" y="8" width="13" height="14.5" rx="2" fill="none" stroke="#2e5b4f" stroke-width="2"/><path d="M11.5 12.5h7M11.5 15.5h7M11.5 18.5h4" stroke="#2e5b4f" stroke-width="1.8" stroke-linecap="round"/>',
  phone:
    '<rect x="10.5" y="6.5" width="9" height="17" rx="2" fill="none" stroke="#2e5b4f" stroke-width="2"/><path d="M13.5 20.5h3" stroke="#2e5b4f" stroke-width="1.8" stroke-linecap="round"/>',
  sync: '<path d="M21 12.5a6.5 6.5 0 0 0-11.6-1.8M9 17.5a6.5 6.5 0 0 0 11.6 1.8" fill="none" stroke="#2e5b4f" stroke-width="2" stroke-linecap="round"/><path d="M21.5 8.5v4h-4M8.5 21.5v-4h4" fill="none" stroke="#2e5b4f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

function step(icon, title, what, norban, visitors, k) {
  return `<article class="step">
<svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="15" fill="#e3ece8"/>${ICONS[icon]}</svg>
<h3>${escapeHtml(title)}</h3>
<p class="what">${escapeHtml(what)}</p>
<dl><dt>For ${escapeHtml(k.brand)}</dt><dd>${escapeHtml(norban)}</dd><dt>For visitors</dt><dd>${escapeHtml(visitors)}</dd></dl>
</article>`;
}

function stepFast(f, k) {
  const slowest = Math.ceil(Math.max(f.speed.ours.home.lcp, f.speed.ours.property.lcp));
  const what = `The main content shows in under ${numberWord(slowest).toLowerCase()} seconds${k.still ? ', and nothing moves while the page loads' : ''}.`;
  return [
    k.fast,
    'fast',
    'Fast on every phone',
    what,
    'Google writes that good speed aligns with what its ranking rewards.',
    'The first screen appears at once, even on mobile data.',
  ];
}

function stepPages(f, k) {
  const parts = [
    f.counts.associations > 0
      ? `a page for each of the ${f.counts.associations} housing associations`
      : '',
    f.counts.areas > 0
      ? f.areaPage.hasMap
        ? 'a map for every area'
        : 'a page for every area'
      : '',
    'lists of all homes, agents and areas',
  ].filter(Boolean);
  const norban = `A search for a building or an area can land on ${k.brandPos} own page${f.features.valuation ? ', which offers a free valuation' : ''}.`;
  const visitors =
    f.counts.associations > 0
      ? "A building's documents and sold homes together."
      : "Every area's homes in one place.";
  return [
    k.morePages,
    'building',
    'Pages that bring buyers in',
    `${capitalize(prose(parts))}.`,
    norban,
    visitors,
  ];
}

function stepForms(f, k) {
  const profile = f.features.searchProfile;
  const what = `Each form opens in a short window${profile ? ` and can also save the visitor's home search in ${k.crm}` : ''}.`;
  const norban = `We expect more valuation requests${profile ? ' and buyer profiles' : ''}${f.features.robotCheck ? ', and a robot check keeps junk out' : ''}.`;
  const visitors = f.features.autocomplete
    ? 'The phone fills in name, phone and e-mail by itself.'
    : 'A short window instead of a long page.';
  return [k.forms, 'form', 'Forms that bring more leads', what, norban, visitors];
}

function steps(f, k) {
  const list = [
    stepFast(f, k),
    [
      k.readable,
      'search',
      'Readable by Google and AI assistants',
      'Every home, list and heading arrives as finished text that Google and assistants such as ChatGPT can read.',
      'Homes can appear in searches and in AI answers.',
      f.home.ogImage
        ? 'A shared home shows its photo and first lines.'
        : 'Every home is a link Google can follow.',
    ],
    stepPages(f, k),
    stepForms(f, k),
    [
      true,
      'phone',
      'Clear on a small screen',
      `Cards name the area and the next viewing, photos open full screen${f.home.hasMap ? ', and every home sits on a map' : ''}.`,
      k.accessible
        ? `An accessibility score of ${f.speed.ours.home.a11y} of 100 helps the site reach every buyer, screen reader users too.`
        : 'Every buyer finds the facts quickly.',
      'The facts read at a glance.',
    ],
    [
      true,
      'sync',
      'Runs itself, with less to maintain',
      `Kowboy's service tells the site as soon as ${k.crm} reports a change, and the site checks again every 15 minutes.`,
      'One theme and one plugin do the work, so there are fewer parts to keep updated.',
      `What they see is what ${k.crm} says now.`,
    ],
  ].filter(([show]) => show);
  return {
    stepsWord: `${numberWord(list.length)} steps forward`,
    stepsHtml: list.map(([, ...rest]) => step(...rest, k)).join('\n'),
  };
}

function trimSnippet(text, max = 155) {
  if (text.length <= max) return text;
  return `${text.slice(0, text.lastIndexOf(' ', max))} …`;
}

function seoLead(f, k) {
  const ctas = [
    [f.features.valuation, 'a free valuation'],
    [f.features.interest, 'registering interest'],
    [f.features.viewing, 'booking a viewing'],
  ]
    .filter(([show]) => show)
    .map(([, text]) => text);
  const landing =
    ctas.length > 0
      ? `they land one tap from ${prose(ctas)}, and the request reaches ${k.crm} as a lead`
      : "they land on the broker's own page";
  return `People who search for a home in an area, for a building's housing association or for a broker are planning a move. When Google answers with ${k.brandPos} own page, ${landing}.`;
}

/** The search features, each shown only when the run checked it on the live site. */
function seoFeatures(f, k) {
  const c = f.counts;
  const homes = [
    [c.forSale, 'for sale'],
    [c.coming, 'coming'],
    [c.sold, 'sold'],
  ].filter(([n]) => n > 0);
  const pages = [
    [c.homes, `homes (${homes.map(([n, what]) => `${n} ${what}`).join(', ')})`],
    [c.areas, 'areas'],
    [c.associations, 'housing associations'],
    [c.agents, 'agents'],
  ].filter(([n]) => n > 0);
  const words = escapeHtml(f.home.path.replace(/-[^-]+\/$/, '-…'));
  const list = [
    [
      c.homes > 0,
      `A page for everything ${k.brand} sells`,
      `${capitalize(prose(pages.map(([n, what]) => `${n} ${what}`)))}, all in the sitemap Google reads.`,
    ],
    [
      true,
      'Search words in every address',
      `Status, town, area and street in every home's address: <code>${words}</code>`,
      true,
    ],
    [
      Boolean(f.home.description),
      'A title and a description for every home',
      "Taken from the listing's own text, as in the search result above.",
    ],
    [
      k.readable,
      'Finished text, no scripts needed',
      `${f.home.headings} headings on a home's page, and every home in a list is a link Google can follow.`,
    ],
    [
      Boolean(f.home.ogImage),
      'A photo and text when shared',
      `Each home shares its first photo${/_1200\./.test(f.home.ogImage ?? '') ? ' at 1,200 pixels' : ''} and the opening of its text.`,
    ],
    [
      f.features.forwardsById,
      'Moved addresses keep their visitors',
      "When a home's address changes, for example when it is sold, the old address forwards to the new one, so links keep working and Google follows the move.",
    ],
    [
      f.features.lastmod,
      'Google hears of every change',
      `A home's change date in the sitemap moves only when the home changes in ${k.crm}, so Google knows which pages to read again.`,
    ],
    [
      f.features.canonicalPages,
      'Every page of a list counts',
      'Page two and onward of a list keep their own address, so Google reads every home in it.',
    ],
    [k.fast, 'Fast pages', "Speed is part of what Google's ranking rewards (page one)."],
  ].filter(([show]) => show);
  return list
    .map(
      ([, title, text, isHtml]) =>
        `<li>${CHECK}<div><h3>${escapeHtml(title)}</h3><p>${isHtml ? text : escapeHtml(text)}</p></div></li>`,
    )
    .join('\n');
}

/** The search page's path from a search to a customer, worded by the forms the site has. */
function pathWords(f) {
  const tap = [
    [f.features.valuation, 'a free valuation'],
    [f.features.viewing, 'a viewing'],
  ].filter(([show]) => show);
  const leads = [
    [f.features.interest, 'an interest'],
    [f.features.viewing, 'a viewing'],
    [f.features.valuation, 'a valuation request'],
  ].filter(([show]) => show);
  return {
    oneTap: tap.length > 0,
    oneTapWhat: orList(tap.map(([, what]) => what)),
    leadWhat:
      leads.length > 0
        ? `${capitalize(orList(leads.map(([, what]) => what)))} reaches the agent.`
        : 'The agent sees who came from search.',
  };
}

function seoPart(f, k) {
  const seo = f.speed.ours.property.seo;
  const path = f.home.path.replace(/^\/|\/$/g, '').split('/');
  return {
    ...pathWords(f),
    seoLead: seoLead(f, k),
    query: `bostad till salu ${f.home.area}`.trim(),
    serpSite: k.brandFull,
    brandInitial: k.brandFull.charAt(0).toUpperCase(),
    serpCrumb: `${k.theirHost} › ${path[0]} › ${path[1].replace(/-[^-]+$/, '').slice(0, 34)}…`,
    serpTitle: `${f.home.street} - ${k.brandFull}`,
    serpSnippet: trimSnippet(f.home.description || ''),
    seoFeaturesHtml: seoFeatures(f, k),
    seoScoreShow: seo >= 90,
    seoScore: seo,
    seoScoreNote: f.features.noindex
      ? " The preview's deliberate block on search engines is left out."
      : '',
  };
}

export function buildModel(f) {
  const brandPos = possessive(f.brand);
  const k = {
    ...flags(f),
    brand: f.brand,
    brandFull: f.brandFull,
    brandPos,
    crm: f.crm,
    theirHost: f.theirs.host,
  };
  const rows = speedRows(f.speed);
  return {
    ...k,
    monthYear: monthYear(f.date),
    runsText:
      f.runs === 1
        ? 'one run per page'
        : `middle of ${numberWord(f.runs ?? 3).toLowerCase()} runs per page`,
    dateLong: longDate(f.date),
    lead: lead(k),
    propImg: f.images.property,
    propCaption: `A home's page on a phone: area, street, ${f.home.hasViewing ? 'viewing, ' : ''}price, rooms and size at a glance.`,
    propAlt: `A home's page on a phone in the next generation: ${f.home.street} in ${f.home.area}, with its facts over the photo`,
    tilesHtml: tiles(f, k),
    contactHtml: contactTile(f, k),
    showChart: rows.length > 0,
    chartHtml: rows.length > 0 ? chartSvg(rows) : '',
    ...keepItems(f, k),
    ...steps(f, k),
    listImg: f.images.list,
    areaImg: f.images.area,
    showArea: Boolean(f.images.area),
    noArea: !f.images.area,
    chat: f.features.chat,
    oursKind: f.features.noindex ? 'a preview of the next generation' : 'the next generation',
    ...seoPart(f, k),
  };
}
