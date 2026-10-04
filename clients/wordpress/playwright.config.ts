// The WordPress client's user journeys (docs/search.md, test 5), walked in a real browser against
// the real site: the plugin and the theme "Kowboy 2026" on the WordPress of test/setup.sh, with
// the template suite's records brought in through a real Core (test/journey-site.ts). "It passed
// the tests" then means "a visitor could do it".
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env['WORDPRESS_JOURNEY_PORT'] ?? 4320);
/**
 * Where a browser already lives, for a machine that has one but not the one Playwright would
 * download (a sandbox with a preinstalled Chromium). Unset, Playwright uses its own, as CI does
 * after `npx playwright install chromium`.
 */
const BROWSER = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'];

export default defineConfig({
  testDir: fileURLToPath(new URL('./e2e', import.meta.url)),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    ...(BROWSER ? { launchOptions: { executablePath: BROWSER } } : {}),
  },
  webServer: {
    // The journey site, out of `dist`, so the journeys walk what `npm run build` makes. The Till
    // salu page is made last, once the records are on the site, so it is what is waited for.
    command: `node dist/clients/wordpress/test/journey-site.js ${String(PORT)}`,
    url: `http://127.0.0.1:${String(PORT)}/?pagename=till-salu`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
  },
});
