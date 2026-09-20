// The browser journeys: every user journey of the panel driven in a real browser against a Core
// started as the tests start it (admin/e2e/server.mjs), with the fake CRM behind it. Run after
// `npm run build`; `npm run test:e2e`.
import { defineConfig, devices } from '@playwright/test';

const PORT = 3199;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env['PLAYWRIGHT_JSON']
    ? [['list'], ['json', { outputFile: process.env['PLAYWRIGHT_JSON'] }]]
    : [['list']],
  outputDir: './test-results',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `node admin/e2e/server.mjs`,
    url: `http://127.0.0.1:${PORT}/v1/ready`,
    reuseExistingServer: false,
    cwd: '..',
    timeout: 60_000,
    env: { PORT: String(PORT) },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
