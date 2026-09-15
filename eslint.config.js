import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Warnings only: lint never blocks a merge (strategy §3.2). CI reports them. */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'clients/lovable-kit/supabase/**'] },
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
);
