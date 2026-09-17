import { defineConfig } from 'vitest/config';

/**
 * The WordPress client suite needs a WordPress install and a MariaDB or MySQL database
 * (clients/wordpress/test/setup.sh), so it runs on its own: `npm run test:wordpress`.
 */
export default defineConfig({
  test: {
    include: ['clients/wordpress/**/*.test.ts'],
    setupFiles: ['acceptance/setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
