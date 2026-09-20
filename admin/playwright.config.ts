// The user journeys of docs/admin-panel-rebuild.md §1, walked in a real browser against a real
// Core: the app as `npm run build` makes it, served by the web process as it is deployed, with the
// fake CRM behind it. "It passed the tests" then means "a person could do it" (§8, process step 4).
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env['JOURNEY_PORT'] ?? 4319);
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
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI']
    ? [['list'], ['json', { outputFile: 'admin/e2e/report.json' }]]
    : 'list',
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    ...(BROWSER ? { launchOptions: { executablePath: BROWSER } } : {}),
  },
  webServer: {
    // The journey Core: the built app, the engine and one fake CRM to onboard against, all out of
    // `dist`, so the journeys walk what `npm run build` makes and not a development copy.
    command: `node dist/scripts/journey-core.js ${String(PORT)}`,
    url: `http://127.0.0.1:${String(PORT)}/v1/ready`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
  },
});
