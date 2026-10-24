import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'engine/**/*.test.ts',
      'adapters/**/*.test.ts',
      'acceptance/**/*.test.ts',
      'clients/lovable-kit/**/*.test.ts',
      'panel/**/*.test.ts',
    ],
    setupFiles: ['acceptance/setup.ts'],
    // No test sends real mail, even where the environment holds SES's keys; empty reads as unset.
    env: { AWS_SES_AWS_ACCESS_KEY_ID: '' },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
