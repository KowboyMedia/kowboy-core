import { defineConfig } from 'vitest/config';

/**
 * The release path as App Platform runs it (AC 18) needs DIGITALOCEAN_ACCESS_TOKEN to read both
 * apps' settings, so it runs on its own: `npm run test:platform`, and in the acceptance report.
 */
export default defineConfig({
  test: {
    include: ['.do/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
