// Deploy the WordPress client and the theme (the template set) to a site over HTTPS, the way a person
// would through the WordPress admin: sign in, upload each package's zip (replacing what is there),
// activate it, and write the plugin's settings. Then the page cache: Cache Enabler is installed from
// wordpress.org when the site lacks it, activated and set (the plugin tells it what to purge,
// core-client/includes/page-cache.php), and emptied, since new views change every page. Nothing but
// web traffic leaves the machine, so an agent's session can run it against any host
// (docs/staging-site.md, "Access, the whole workflow").
//
//   SITE_URL=https://… WP_USER=… WP_PASSWORD=… node scripts/deploy-site.mjs [--settings <json>]
//
// The settings JSON, when given, holds any of core_client_url, core_client_token,
// core_client_bell_secret, core_client_template_set, core_client_styleisolation,
// core_client_status_for_sale, core_client_status_coming, core_client_status_sold and
// core_client_publish_<kind>; the rest of the form keeps its values. Secrets come from the environment or the JSON, never from a file in
// the repository.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const site = (process.env['SITE_URL'] ?? '').replace(/\/$/, '');
const user = process.env['WP_USER'] ?? '';
const password = process.env['WP_PASSWORD'] ?? '';
if (!site || !user || !password) {
  console.error('SITE_URL, WP_USER and WP_PASSWORD must be set');
  process.exit(1);
}
const settingsArg = process.argv.indexOf('--settings');
const settings = settingsArg > -1 ? JSON.parse(process.argv[settingsArg + 1] ?? '{}') : null;

/** A cookie jar the size of one sign-in. */
const jar = new Map();
const cookieHeader = () => [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
const remember = (response) => {
  for (const line of response.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
};

async function call(path, init = {}) {
  const response = await fetch(`${site}${path}`, {
    ...init,
    redirect: 'manual',
    headers: { ...(init.headers ?? {}), cookie: cookieHeader() },
  });
  remember(response);
  return response;
}

/** Follow a redirect chain by hand, keeping the cookies. */
async function follow(response, hops = 5) {
  let current = response;
  for (let hop = 0; hop < hops && [301, 302, 303].includes(current.status); hop += 1) {
    const location = current.headers.get('location');
    if (!location) break;
    const path = location.startsWith('http') ? location.slice(site.length) : location;
    current = await call(path);
  }
  return current;
}

async function signIn() {
  await call('/wp-login.php');
  const body = new URLSearchParams({
    log: user,
    pwd: password,
    'wp-submit': 'Log In',
    redirect_to: `${site}/wp-admin/`,
    testcookie: '1',
  });
  jar.set('wordpress_test_cookie', 'WP+Cookie+check');
  const response = await call('/wp-login.php', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (![302, 303].includes(response.status) || !cookieHeader().includes('wordpress_logged_in')) {
    throw new Error(`the sign-in was refused (http ${response.status})`);
  }
}

/** The nonce a form on an admin page carries, by the field or the action it names. */
const nonceIn = (html, pattern) => {
  const found = pattern.exec(html);
  if (!found) throw new Error(`no nonce for ${pattern}`);
  return found[1];
};

/** The REST nonce the admin pages carry, so the WordPress REST API answers for the signed-in user. */
let restNonce = '';
async function rest(path, init = {}) {
  const response = await call(`/wp-json/wp/v2${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'x-wp-nonce': restNonce,
      'content-type': 'application/json',
    },
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function pageHtml(path) {
  const response = await follow(await call(path));
  if (response.status !== 200) throw new Error(`${path} answered http ${response.status}`);
  return response.text();
}

/** The version a package's main file declares. */
const versionOf = (dir, name) =>
  /^\s*\*?\s*Version:\s*(\S+)/m.exec(
    readFileSync(join(dir, name === 'style' ? 'style.css' : `${name}.php`), 'utf8'),
  )?.[1] ?? '';

/**
 * Upload one package's zip; when the plugin is there already, replace it with the upload. The
 * proof is the REST API's word on the installed version, so the site's language plays no part.
 */
async function upload(pkg, zipPath) {
  const installPage = await pageHtml('/wp-admin/plugin-install.php?tab=upload');
  const nonce = nonceIn(installPage, /name="_wpnonce" value="([^"]+)"/);
  const form = new FormData();
  form.set('_wpnonce', nonce);
  form.set('_wp_http_referer', '/wp-admin/plugin-install.php?tab=upload');
  form.set('install-plugin-submit', 'Install Now');
  form.set(
    'pluginzip',
    new Blob([readFileSync(zipPath)], { type: 'application/zip' }),
    `${pkg.name}.zip`,
  );
  const response = await follow(
    await call('/wp-admin/update.php?action=upload-plugin', { method: 'POST', body: form }),
  );
  const html = await response.text();
  const replace =
    /update\.php\?action=upload-plugin&amp;package=([^&"]+)&amp;overwrite=update-plugin&amp;_wpnonce=([^"&]+)/.exec(
      html,
    );
  if (replace) {
    // The plugin exists: WordPress offers "Replace current with uploaded"; take it.
    await follow(
      await call(
        `/wp-admin/update.php?action=upload-plugin&package=${replace[1]}&overwrite=update-plugin&_wpnonce=${replace[2]}`,
      ),
    );
  }
  const installed = await rest(`/plugins/${pkg.file.replace(/\.php$/, '')}`);
  if (installed.body?.version !== pkg.version) {
    // WordPress's own words for what went wrong (a PHP version too old, a broken zip), from the page's content.
    const content = html.slice(html.indexOf('id="wpbody-content"'));
    const notice = content
      .replace(/<script[\s\S]*?<\/script>|<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    throw new Error(
      `${pkg.name}: ${pkg.version} is not what the site holds after the upload: ${notice.slice(0, 400)}`,
    );
  }
  console.log(`${pkg.name} ${pkg.version}: uploaded`);
}

async function activate(pkg) {
  const plugin = pkg.file.replace(/\.php$/, '');
  const current = await rest(`/plugins/${plugin}`);
  if (current.body?.status === 'active') {
    console.log(`${pkg.name}: already active`);
    return;
  }
  const activated = await rest(`/plugins/${plugin}`, {
    method: 'POST',
    body: JSON.stringify({ status: 'active' }),
  });
  if (activated.body?.status !== 'active')
    throw new Error(`${pkg.name}: the activation was refused (http ${activated.status})`);
  console.log(`${pkg.name}: activated`);
}

/** Upload a theme's zip the same way, replacing it when it is there; the proof is the REST API's word on the version. */
async function uploadTheme(pkg, zipPath) {
  const installPage = await pageHtml('/wp-admin/theme-install.php?browse=featured');
  const nonce = nonceIn(installPage, /name="_wpnonce" value="([^"]+)"/);
  const form = new FormData();
  form.set('_wpnonce', nonce);
  form.set('_wp_http_referer', '/wp-admin/theme-install.php');
  form.set('install-theme-submit', 'Install Now');
  form.set(
    'themezip',
    new Blob([readFileSync(zipPath)], { type: 'application/zip' }),
    `${pkg.name}.zip`,
  );
  const response = await follow(
    await call('/wp-admin/update.php?action=upload-theme', { method: 'POST', body: form }),
  );
  const html = await response.text();
  const replace =
    /update\.php\?action=upload-theme&amp;package=([^&"]+)&amp;overwrite=update-theme&amp;_wpnonce=([^"&]+)/.exec(
      html,
    );
  if (replace) {
    await follow(
      await call(
        `/wp-admin/update.php?action=upload-theme&package=${replace[1]}&overwrite=update-theme&_wpnonce=${replace[2]}`,
      ),
    );
  }
  const installed = await rest(`/themes/${pkg.name}`);
  if (installed.body?.version !== pkg.version) {
    const content = html.slice(html.indexOf('id="wpbody-content"'));
    const notice = content
      .replace(/<script[\s\S]*?<\/script>|<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    throw new Error(
      `${pkg.name}: ${pkg.version} is not what the site holds after the upload: ${notice.slice(0, 400)}`,
    );
  }
  console.log(`${pkg.name} ${pkg.version}: uploaded`);
}

async function activateTheme(pkg) {
  const current = await rest(`/themes/${pkg.name}`);
  if (current.body?.status === 'active') {
    console.log(`${pkg.name}: already active`);
    return;
  }
  const html = await pageHtml('/wp-admin/themes.php');
  const link = new RegExp(
    `themes\\.php\\?action=activate&amp;stylesheet=${pkg.name}&amp;_wpnonce=([^"&]+)`,
  ).exec(html);
  if (!link) throw new Error(`${pkg.name}: no activation link on the themes page`);
  await follow(
    await call(`/wp-admin/themes.php?action=activate&stylesheet=${pkg.name}&_wpnonce=${link[1]}`),
  );
  const after = await rest(`/themes/${pkg.name}`);
  if (after.body?.status !== 'active') throw new Error(`${pkg.name}: the activation did not take`);
  console.log(`${pkg.name}: activated`);
}

/** The page cache the plugin purges: Cache Enabler, from wordpress.org when the site lacks it. */
const PAGE_CACHE = { name: 'cache-enabler', file: 'cache-enabler/cache-enabler.php' };

async function installPageCache() {
  const plugin = PAGE_CACHE.file.replace(/\.php$/, '');
  const current = await rest(`/plugins/${plugin}`);
  if (current.status === 404) {
    const installed = await rest('/plugins', {
      method: 'POST',
      body: JSON.stringify({ slug: PAGE_CACHE.name, status: 'active' }),
    });
    if (installed.body?.status !== 'active')
      throw new Error(`${PAGE_CACHE.name}: the install was refused (http ${installed.status})`);
    console.log(`${PAGE_CACHE.name} ${installed.body.version}: installed and activated`);
    return;
  }
  await activate(PAGE_CACHE);
}

/**
 * Cache Enabler's settings, as a person sets them on its page. A kept page is built anew after 24
 * hours at the latest, for what no purge covers (the year in the footer, the site's title). An
 * address with a query other than an ad's tracking is never kept: Cache Enabler's own rule looks
 * only at the first key and keeps a page under its address without the query, so
 * `?utm_source=x&q=Lund` would be kept as the unfiltered list. The rest stays as Cache Enabler ships it.
 */
const PAGE_CACHE_SETTINGS = {
  cache_expires: '1',
  cache_expiry_time: '24',
  excluded_query_strings:
    '/(?:^|&)(?!(?:utm_(?:source|medium|campaign|term|content|expid)|fbclid|gclid|ref|mc_(?:cid|eid)|fb_(?:action_ids|action_types|source)|_ga|_ke)(?:=|&|$))[^&]/',
};

async function writePageCacheSettings() {
  const path = '/wp-admin/options-general.php?page=cache-enabler';
  const page = await pageHtml(path);
  const form = page.slice(page.indexOf('action="options.php"'));
  const body = new URLSearchParams({
    option_page: 'cache_enabler',
    action: 'update',
    _wpnonce: nonceIn(form, /name="_wpnonce" value="([^"]+)"/),
    _wp_http_referer: path,
  });
  for (const [name, value] of Object.entries(PAGE_CACHE_SETTINGS))
    body.set(`cache_enabler[${name}]`, value);
  const response = await call('/wp-admin/options.php', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (![302, 303].includes(response.status))
    throw new Error(`Cache Enabler's settings were refused (http ${response.status})`);
  // The proof is the settings page's word on each value: a box ticked, or a field's text.
  const saved = await pageHtml(path);
  for (const [name, value] of Object.entries(PAGE_CACHE_SETTINGS)) {
    const input =
      new RegExp(`<input[^>]*name="cache_enabler\\[${name}\\]"[^>]*>`).exec(saved)?.[0] ?? '';
    const shown = /type="checkbox"/.test(input)
      ? /checked/.test(input)
        ? '1'
        : '0'
      : (/value="([^"]*)"/.exec(input)?.[1] ?? '').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
    if (shown !== value) throw new Error(`Cache Enabler's ${name} is not what was written`);
  }
  console.log('page cache: settings written');
}

/** Empty the page cache, by the link Cache Enabler puts in the admin bar. */
async function clearPageCache() {
  const html = await pageHtml('/wp-admin/');
  const nonce = nonceIn(
    html,
    /_cache=cache-enabler&(?:amp;|#038;)?_action=clear&(?:amp;|#038;)?_wpnonce=([0-9a-f]+)/,
  );
  const response = await call(`/wp-admin/?_cache=cache-enabler&_action=clear&_wpnonce=${nonce}`);
  if (![302, 303].includes(response.status))
    throw new Error(`the page cache was not emptied (http ${response.status})`);
  console.log('page cache: emptied');
}

/**
 * Whether WordPress hands pages to the cache at all: wp-config.php must set WP_CACHE to true, and
 * Cache Enabler's settings page warns, naming that line, while it does not.
 */
async function checkPageCacheOn() {
  const html = await pageHtml('/wp-admin/options-general.php?page=cache-enabler');
  if (html.includes("define( 'WP_CACHE', true );"))
    console.log(
      'page cache: NOT ON. wp-config.php does not set WP_CACHE to true, so no kept page is served',
    );
}

const TEXT_SETTINGS = [
  'core_client_url',
  'core_client_token',
  'core_client_bell_secret',
  'core_client_status_for_sale',
  'core_client_status_coming',
  'core_client_status_sold',
];

/** The settings form as the page shows it: every field's current value, so a partial write keeps the rest. */
function formValues(html) {
  const values = {};
  for (const name of TEXT_SETTINGS) {
    const found = new RegExp(`name="${name}"[^>]*value="([^"]*)"`).exec(html);
    values[name] = found ? found[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '';
  }
  values.core_client_template_set =
    /name="core_client_template_set"[\s\S]*?<option value="([^"]*)"[^>]*selected/.exec(html)?.[1] ??
    '';
  values.core_client_styleisolation = /name="core_client_styleisolation"[^>]*checked/.test(html);
  // What the site publishes of each kind of record: a setting the form leaves out is written as
  // "Published", so every one is carried back.
  for (const [, name, value] of html.matchAll(
    /name="(core_client_publish_[a-z_]+)"[\s\S]*?<option value="([^"]*)"[^>]*selected/g,
  ))
    values[name] = value;
  return values;
}

async function writeSettings(values) {
  const html = await pageHtml('/wp-admin/options-general.php?page=core-client');
  const merged = { ...formValues(html), ...values };
  const body = new URLSearchParams({
    option_page: 'core_client',
    action: 'update',
    _wpnonce: nonceIn(html, /name="_wpnonce" value="([^"]+)"/),
    _wp_http_referer: '/wp-admin/options-general.php?page=core-client',
  });
  for (const name of [...TEXT_SETTINGS, 'core_client_template_set']) body.set(name, merged[name]);
  for (const name of Object.keys(merged).filter((key) => key.startsWith('core_client_publish_')))
    body.set(name, merged[name]);
  if ([true, 'true', '1'].includes(merged.core_client_styleisolation))
    body.set('core_client_styleisolation', '1');
  const response = await call('/wp-admin/options.php', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (![302, 303].includes(response.status)) {
    throw new Error(`the settings were refused (http ${response.status})`);
  }
  console.log('settings: written');
}

const out = mkdtempSync(join(tmpdir(), 'core-client-deploy-'));
const release = join(root, 'clients', 'wordpress', 'release.php');
const channel = process.env['CORE_CLIENT_CHANNEL'] ?? 'https://example.invalid/channel';
const packages = [
  {
    kind: 'plugin',
    name: 'core-client',
    dir: join(root, 'clients', 'wordpress', 'core-client'),
    file: 'core-client/core-client.php',
  },
];
for (const slug of readdirSync(join(root, 'clients', 'wordpress', 'themes'))) {
  packages.push({
    kind: 'theme',
    name: slug,
    dir: join(root, 'clients', 'wordpress', 'themes', slug),
    file: 'style.css',
  });
}
for (const pkg of packages) {
  pkg.version = versionOf(pkg.dir, pkg.kind === 'theme' ? 'style' : pkg.name);
  execFileSync('php', [release, 'package', pkg.dir, pkg.name, out, channel], { stdio: 'inherit' });
}

await signIn();
restNonce = nonceIn(await pageHtml('/wp-admin/'), /createNonceMiddleware\(\s*"([^"]+)"\s*\)/);
for (const pkg of packages) {
  if (pkg.kind === 'theme') {
    await uploadTheme(pkg, join(out, `${pkg.name}.zip`));
    await activateTheme(pkg);
  } else {
    await upload(pkg, join(out, `${pkg.name}.zip`));
    await activate(pkg);
  }
}
if (settings) await writeSettings(settings);
await installPageCache();
await writePageCacheSettings();
await clearPageCache();
await checkPageCacheOn();
console.log(`deployed to ${site}`);
