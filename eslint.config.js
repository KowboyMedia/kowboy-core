import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Warnings only: lint never blocks a merge (strategy §3.2). CI reports them. */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'admin/dist/**',
      'node_modules/**',
      'clients/lovable-kit/supabase/**',
      'clients/wordpress/core-client/lib/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['admin/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      complexity: ['warn', 12],
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
);
