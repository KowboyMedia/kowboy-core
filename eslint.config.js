import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Warnings only: lint never blocks a merge (strategy §3.2). CI reports them. */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'clients/lovable-kit/supabase/**',
      'clients/wordpress/core-client/lib/**',
      'clients/wordpress/themes/**/assets/vendor/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
  {
    // The admin area's components. `complexity` counts decision points in a function, which for
    // Node control flow says how hard it is to follow; in JSX every conditional piece a page
    // renders counts too, so it says how much the page shows instead. The rule stays on for the
    // app's own code (.ts), where it means what it was set for.
    files: ['admin/src/**/*.tsx'],
    languageOptions: { globals: { ...globals.browser } },
    rules: { complexity: 'off' },
  },
  {
    files: ['admin/src/**/*.ts', 'admin/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // The theme's scripts run in the visitor's browser and the editor, without a build step.
    files: ['clients/wordpress/themes/**/assets/*.js'],
    languageOptions: { globals: { ...globals.browser }, sourceType: 'script' },
  },
);
