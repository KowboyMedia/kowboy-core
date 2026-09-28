// Screenshots of a site's pages, for iterating on a template set against a live site
// (docs/staging-site.md, "The loop as it runs"): the property list, the first property it links
// to, and the agent list, at desktop and phone widths, as JPEG files in a folder.
//
//   SITE_URL=https://… node scripts/shoot-site.mjs <folder> [path …]
//
// Without paths: /objekt/ and /maklare/, plus the first property the list links to. Every
// request the browser makes is fetched by Node, which trusts the session's proxy, so the browser
// itself never speaks TLS and no certificate check is switched off.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const site = (process.env['SITE_URL'] ?? '').replace(/\/$/, '');
const [folder, ...paths] = process.argv.slice(2);
if (!site || !folder) {
  console.error('SITE_URL must be set and a folder given');
  process.exit(1);
}
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'],
});

const fileName = (path) => path.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home';

/** One page at one width: its screenshot, and the property links it holds. */
async function shoot(path, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.route('**/*', async (route) => {
    const request = route.request();
    try {
      const response = await fetch(request.url(), {
        method: request.method(),
        headers: request.headers(),
        body: request.postDataBuffer() ?? undefined,
      });
      const headers = {};
      response.headers.forEach((value, key) => {
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key))
          headers[key] = value;
      });
      await route.fulfill({
        status: response.status,
        headers,
        body: Buffer.from(await response.arrayBuffer()),
      });
    } catch {
      await route.abort();
    }
  });
  const response = await page.goto(`${site}${path}`, { waitUntil: 'networkidle', timeout: 90000 });
  // Scroll through the page so every lazy image has loaded before the picture is taken.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const file = join(folder, `${fileName(path)}-${width}.jpg`);
  await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 70 });
  const links = await page.$$eval('a[href*="/objekt/"]', (anchors) =>
    anchors.map((a) => a.getAttribute('href')),
  );
  console.log(`${path} (${width}): http ${response?.status()} → ${file}`);
  await page.close();
  return links.filter((href) => href && href !== '/objekt/' && !href.endsWith('/objekt/'));
}

const pages = paths.length ? paths : ['/objekt/', '/maklare/'];
for (const path of pages) {
  const links = await shoot(path, 1280);
  await shoot(path, 400);
  if (!paths.length && path === '/objekt/' && links[0]) {
    const property = new URL(links[0], site).pathname;
    await shoot(property, 1280);
    await shoot(property, 400);
  }
}
await browser.close();
