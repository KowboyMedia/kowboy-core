// Makes the promotion report: a site built on Kowboy Core ("ours") next to the client's current
// site ("theirs"). Both sites are only read: GET and HEAD requests, page views and Lighthouse
// runs. No button is pressed and no form is sent; the browser aborts every other request.
//
//   node .claude/skills/kowboy-site-promotion-realestate/report.mjs --ours <url> --theirs <url> --out <dir>
//     [--brand Norban] [--brandFull "Norban Mäkleri"] [--crm Vitec] [--runs 3] [--list /till-salu/]
//     [--property /objekt/<path>/] [--date YYYY-MM-DD]
//   node …/report.mjs --from <dir>/facts.json --out <dir>    re-renders without measuring again
//
// Writes report.html, report.pdf, sheet-<n>.png (each printed page), facts.json and check.json.
/* global document, window */

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import {
  areaFor,
  canonicalOf,
  countSitemap,
  formFeatures,
  homeLinks,
  idOf,
  matchedHomes,
  metas,
  parseArgs,
  readHome,
  render,
  summarize,
  theirsBetter,
} from './lib.mjs';
import { buildModel } from './model.mjs';

const HERE = new URL('.', import.meta.url).pathname;
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/opt/pw-browsers/chromium';
const PROXY = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const LIGHTHOUSE = 'lighthouse@12.8.2';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const THEIR_SITEMAPS = ['/sitemap_index.xml', '/wp-sitemap.xml', '/sitemap.xml'];
const exec = promisify(execFile);
const log = (...parts) => console.error(new Date().toISOString().slice(11, 19), ...parts);

// ---- Reading the sites (GET and HEAD only) ----

const nocache = (url) => `${url}${url.includes('?') ? '&' : '?'}nocache=${Date.now()}`;

function request(url, init = {}) {
  return fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, 'Accept-Language': 'sv-SE,sv;q=0.9' },
  });
}

async function page(url) {
  const res = await request(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return { html: await res.text(), headers: res.headers };
}

const locs = (xml) =>
  [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
const everyEntryDated = (xml) =>
  (xml.match(/<url>/g) ?? []).length > 0 &&
  (xml.match(/<url>/g) ?? []).length === (xml.match(/<lastmod>/g) ?? []).length;

/** Every address a site's sitemap lists, and whether every home in it carries a change date. */
async function sitemap(base, paths) {
  for (const path of paths) {
    const res = await request(`${base}${path}`);
    if (!res.ok) continue;
    const xml = await res.text();
    if (!xml.includes('<sitemapindex'))
      return { children: [], urls: locs(xml), homesDated: everyEntryDated(xml) };
    const children = locs(xml);
    const parts = await Promise.all(
      children.map(async (child) => ({ child, xml: await (await request(child)).text() })),
    );
    const homes = parts.filter((p) => /propert|objekt/i.test(p.child));
    return {
      children,
      urls: parts.flatMap((p) => locs(p.xml)),
      homesDated: homes.length > 0 && homes.every((p) => everyEntryDated(p.xml)),
    };
  }
  throw new Error(`no sitemap found on ${base} (tried ${paths.join(', ')})`);
}

/** The home the report shows: for sale on both sites, one with a bookable viewing if there is one. */
async function pickHome(o, ours, theirs) {
  let pairs = matchedHomes(ours.urls, theirs.urls);
  if (o.property) pairs = pairs.filter((p) => new URL(p.ours).pathname === o.property);
  if (pairs.length === 0)
    throw new Error(
      o.property
        ? `${o.property} is not for sale on both sites`
        : 'no home is for sale on both sites; pass --property',
    );
  const seen = [];
  for (const pair of pairs.slice(0, 12)) {
    const { html, headers } = await page(nocache(pair.ours));
    seen.push({ ...pair, html, headers });
    if (html.includes('Boka här')) return { ...pair, html, headers };
  }
  return seen[0];
}

/** Ids of everything Core lists on our site, so only addresses the CRM still lists are checked. */
function listedIds(ours) {
  return new Set(
    ours.urls.filter((u) => /^\/(objekt|maklare)\/./.test(new URL(u).pathname)).map(idOf),
  );
}

async function pool(items, size, work) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await work(items[i]).catch(() => false);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return results;
}

/** Today's addresses for homes and agents still listed: each must answer on our site, or forward to the same record. */
async function addresses(o, ours, theirs) {
  const ids = listedIds(ours);
  const todo = theirs.urls.filter((u) => ids.has(idOf(u)));
  const kept = await pool(todo, 4, async (u) => {
    const res = await request(nocache(`${o.ours}${new URL(u).pathname}`), {
      method: 'HEAD',
      redirect: 'manual',
    });
    if (res.status === 200) return true;
    const to = res.headers.get('location');
    return (
      [301, 308].includes(res.status) && Boolean(to) && idOf(new URL(to, o.ours).href) === idOf(u)
    );
  });
  return {
    checked: todo.length,
    kept: kept.filter(Boolean).length,
    failed: todo.filter((_, i) => !kept[i]).slice(0, 20),
  };
}

/** A home's bare id forwards to its current address, as when a sold home's address changes. */
async function forwardsById(o, homeUrl) {
  const id = idOf(homeUrl);
  const res = await request(nocache(`${o.ours}/objekt/${id}/`), {
    method: 'HEAD',
    redirect: 'manual',
  });
  const to = res.headers.get('location');
  return [301, 308].includes(res.status) && Boolean(to) && idOf(new URL(to, o.ours).href) === id;
}

/** The robot check: the form window carries a key, and the site's own script loads Cloudflare Turnstile. */
async function robotCheck(o, html) {
  if (!formFeatures(html).humanKey) return false;
  const host = new URL(o.ours).host;
  const scripts = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((src) => new URL(src, o.ours).host === host);
  for (const src of scripts) {
    const res = await request(new URL(src, o.ours).href);
    if (res.ok && /challenges\.cloudflare\.com\/turnstile/.test(await res.text())) return true;
  }
  return false;
}

async function readOurs(o, ours, pick) {
  const list = await page(nocache(`${o.ours}${o.list}`));
  const second = await request(`${o.ours}${o.list}?sida=2`);
  const secondHtml = second.ok ? await second.text() : '';
  const areaUrl = areaFor(
    pick.ours,
    ours.urls.filter((u) => new URL(u).pathname.startsWith('/omrade/')),
  );
  const area = areaUrl ? await page(nocache(areaUrl)) : null;
  const noindex = /noindex/i.test(
    `${pick.headers.get('x-robots-tag') ?? ''} ${metas(pick.html).robots ?? ''}`,
  );
  const forms = formFeatures(pick.html);
  return {
    areaUrl,
    home: { ...readHome(pick.html), path: new URL(pick.ours).pathname },
    list: { links: homeLinks(list.html).size },
    areaPage: { hasMap: Boolean(area?.html.includes('k-map')) },
    features: {
      ...forms,
      valuation: forms.valuation && formFeatures(list.html).valuation,
      viewing: pick.html.includes('Boka här'),
      robotCheck: await robotCheck(o, pick.html),
      testKey: /^[123]x0000/.test(forms.humanKey ?? ''),
      forwardsById: await forwardsById(o, pick.ours),
      canonicalPages: canonicalOf(secondHtml).includes('sida=2'),
      lastmod: ours.homesDated,
      noindex,
    },
  };
}

// ---- Speed: Lighthouse as a phone, one run at a time so the sites never share the line ----

async function lighthouse(url, file) {
  const flags = [
    '--headless=new',
    '--no-sandbox',
    ...(PROXY ? [`--proxy-server=${PROXY}`] : []),
  ].join(' ');
  const args = [
    '--yes',
    LIGHTHOUSE,
    url,
    `--chrome-flags=${flags}`,
    '--output=json',
    `--output-path=${file}`,
  ];
  await exec('npx', [...args, '--only-categories=performance,accessibility,seo', '--quiet'], {
    env: { ...process.env, CHROME_PATH: CHROME },
    timeout: 300_000,
    maxBuffer: 1 << 26,
  });
  const lhr = JSON.parse(await readFile(file, 'utf8'));
  if (lhr.runtimeError)
    throw new Error(`Lighthouse could not load ${url}: ${lhr.runtimeError.message}`);
  return lhr;
}

async function speed(o, pick, noindex, dir) {
  await mkdir(dir, { recursive: true });
  const pages = [
    ['theirs', 'home', () => `${o.theirs}/`],
    ['ours', 'home', () => nocache(`${o.ours}/`)],
    ['theirs', 'property', () => pick.theirs],
    ['ours', 'property', () => nocache(pick.ours)],
  ];
  const lhrs = { ours: { home: [], property: [] }, theirs: { home: [], property: [] } };
  for (let n = 1; n <= o.runs; n++) {
    for (const [site, kind, url] of pages) {
      log(`Lighthouse ${site} ${kind}, run ${n} of ${o.runs}`);
      lhrs[site][kind].push(await lighthouse(url(), join(dir, `${site}-${kind}-${n}.json`)));
    }
  }
  // A preview blocks search engines on purpose; that one check is left out of our search score.
  const leaveOut = noindex ? ['is-crawlable'] : [];
  return {
    ours: {
      home: summarize(lhrs.ours.home, leaveOut),
      property: summarize(lhrs.ours.property, leaveOut),
    },
    theirs: { home: summarize(lhrs.theirs.home), property: summarize(lhrs.theirs.property) },
  };
}

// ---- Pictures of our site: page views only ----

const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 480 / 390,
  isMobile: true,
  hasTouch: true,
  userAgent: IPHONE,
};
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

const launch = () =>
  chromium.launch({ executablePath: CHROME, ...(PROXY ? { proxy: { server: PROXY } } : {}) });

async function loadAll(view) {
  await view.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
}

/** One picture as a data address, after `place` scrolls the view and says what to keep. */
async function picture(browser, url, device, place) {
  const context = await browser.newContext({ ...device, locale: 'sv-SE' });
  const view = await context.newPage();
  await view.route('**/*', (route) => {
    const req = route.request();
    // Read-only: only fetching is let through. The chat add-on is left out of the pictures.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) || req.url().includes('kowboy-chat'))
      return route.abort();
    return route.continue();
  });
  await view.goto(nocache(url), { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
  // A preview without its site name shows the server's name in the logo; the picture leaves it out.
  await view.evaluate((host) => {
    for (const name of document.querySelectorAll('.k-logo__name'))
      if (name.textContent.trim() === host) name.style.visibility = 'hidden';
  }, new URL(url).host);
  await loadAll(view);
  const clip = await place(view);
  await view.waitForTimeout(2500);
  const shot = await view.screenshot({
    type: 'jpeg',
    quality: 82,
    ...(clip ? { clip, fullPage: true } : {}),
  });
  await context.close();
  return `data:image/jpeg;base64,${shot.toString('base64')}`;
}

const top = async () => null;

/** The area page with its map in view and the area's name just above it. */
async function mapInView(view) {
  await view.evaluate(() => {
    const map = document.querySelector('.k-map');
    if (map)
      window.scrollTo(0, Math.max(0, map.getBoundingClientRect().top + window.scrollY - 166));
  });
  return null;
}

/** The list's tabs and its first row of cards. */
async function firstRow(view) {
  return view.evaluate(() => {
    const cards = [...document.querySelectorAll('.k-card')].map((c) => c.getBoundingClientRect());
    if (cards.length === 0) return null;
    const row = cards.filter((c) => Math.abs(c.top - cards[0].top) < 4);
    const start = (document.querySelector('.k-tabs')?.getBoundingClientRect() ?? cards[0]).top;
    const left = Math.min(...row.map((c) => c.left));
    const right = Math.max(...row.map((c) => c.right));
    const bottom = Math.max(...row.map((c) => c.bottom));
    return {
      x: Math.max(0, left - 40),
      y: start + window.scrollY - 24,
      width: right - left + 80,
      height: bottom - start + 48,
    };
  });
}

async function pictures(o, pick, areaUrl) {
  const browser = await launch();
  try {
    return {
      property: await picture(browser, pick.ours, PHONE, top),
      area: areaUrl ? await picture(browser, areaUrl, PHONE, mapInView) : null,
      list: await picture(browser, `${o.ours}${o.list}`, DESKTOP, firstRow),
    };
  } finally {
    await browser.close();
  }
}

// ---- Putting it together ----

async function gather(o) {
  log('Reading both sitemaps');
  const [ours, theirs] = await Promise.all([
    sitemap(o.ours, ['/wp-sitemap.xml']),
    sitemap(o.theirs, THEIR_SITEMAPS),
  ]);
  const pick = await pickHome(o, ours, theirs);
  log(`Home shown: ${pick.ours}`);
  const read = await readOurs(o, ours, pick);
  const theirHome = await page(`${o.theirs}/`);
  log("Checking that today's addresses still work");
  const kept = await addresses(o, ours, theirs);
  const measured = await speed(o, pick, read.features.noindex, join(o.out, 'lighthouse'));
  log('Taking pictures');
  const images = await pictures(o, pick, read.areaUrl);
  const brandFull = o.brandFull ?? metas(theirHome.html)['og:site_name'] ?? new URL(o.theirs).host;
  return {
    date: o.date,
    brand: o.brand ?? brandFull,
    brandFull,
    crm: o.crm,
    ours: { url: o.ours, host: new URL(o.ours).host, home: pick.ours },
    theirs: { url: o.theirs, host: new URL(o.theirs).host, home: pick.theirs },
    counts: countSitemap(ours.urls),
    theirsHasAssociations:
      theirs.children.some((c) => /forening|association/i.test(c)) ||
      theirs.urls.some((u) => new URL(u).pathname.startsWith('/forening/')),
    home: read.home,
    list: read.list,
    areaPage: read.areaPage,
    features: read.features,
    addresses: kept,
    runs: o.runs,
    speed: measured,
    images,
  };
}

/** Prints the PDF and checks that every sheet's content fits its page and that the phone view never scrolls sideways. */
async function print(o, htmlFile, pdfFile) {
  const browser = await launch();
  try {
    const sheetView = await browser.newPage({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 1.5,
    });
    await sheetView.goto(`file://${htmlFile}`, { waitUntil: 'networkidle' });
    await sheetView.evaluate(() => document.fonts.ready);
    await sheetView.emulateMedia({ media: 'print' });
    await sheetView.pdf({
      path: pdfFile,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    const sheets = await sheetView.$$('.sheet');
    const fit = [];
    for (const [i, sheet] of sheets.entries()) {
      fit.push(await sheet.evaluate((s) => ({ content: s.scrollHeight, room: s.clientHeight })));
      await sheet.screenshot({ path: join(o.out, `sheet-${i + 1}.png`) });
    }
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(`file://${htmlFile}`, { waitUntil: 'networkidle' });
    const phoneWidth = await phone.evaluate(() => document.documentElement.scrollWidth);
    const pdfPages = (
      (await readFile(pdfFile)).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []
    ).length;
    return { fit, pdfPages, phoneWidth };
  } finally {
    await browser.close();
  }
}

const CLAIMS = [
  'fast',
  'still',
  'readable',
  'morePages',
  'forms',
  'accessible',
  'showChart',
  'showArea',
  'chat',
  'oneTap',
  'seoScoreShow',
];

/** What the report leaves out because a measurement or a check did not carry it. */
function claimsLeftOut(facts, model) {
  const features = Object.entries(facts.features).filter(
    ([k, v]) => v === false && !['noindex', 'testKey'].includes(k),
  );
  const addressesKept =
    facts.addresses.checked > 0 && facts.addresses.kept === facts.addresses.checked;
  return [
    ...CLAIMS.filter((k) => !model[k]),
    ...features.map(([k]) => `features.${k}`),
    ...(addressesKept ? [] : ['addresses']),
  ];
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  await mkdir(o.out, { recursive: true });
  const facts = o.from ? JSON.parse(await readFile(o.from, 'utf8')) : await gather(o);
  if (!o.from) await writeFile(join(o.out, 'facts.json'), JSON.stringify(facts, null, 1));
  const model = buildModel(facts);
  const htmlFile = join(o.out, 'report.html');
  await writeFile(htmlFile, render(await readFile(join(HERE, 'template.html'), 'utf8'), model));
  log('Printing');
  const printed = await print(o, htmlFile, join(o.out, 'report.pdf'));
  const { images: _images, ...plain } = facts;
  const check = {
    ...printed,
    fits:
      printed.fit.every((s) => s.content <= s.room) &&
      printed.pdfPages === printed.fit.length &&
      printed.phoneWidth <= 390,
    theirsBetter: theirsBetter(facts.speed),
    claimsLeftOut: claimsLeftOut(facts, model),
    facts: plain,
  };
  await writeFile(join(o.out, 'check.json'), JSON.stringify(check, null, 1));
  console.log(
    JSON.stringify(
      {
        out: o.out,
        fits: check.fits,
        fit: check.fit,
        pdfPages: check.pdfPages,
        phoneWidth: check.phoneWidth,
        theirsBetter: check.theirsBetter,
        claimsLeftOut: check.claimsLeftOut,
      },
      null,
      1,
    ),
  );
  if (!check.fits) process.exitCode = 2;
}

await main();
