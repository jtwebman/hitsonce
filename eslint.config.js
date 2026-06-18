import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// One-app ESLint config (HitsOnce is a single Worker). Config files are ESM .js
// (no jiti); source + scripts are TypeScript.
export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.wrangler/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,js}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    // TypeScript handles undefined-variable checking; ESLint's is noisy with Worker globals.
    rules: { 'no-undef': 'off' },
  },
  {
    // Kysely (and direct DB access) is data-layer only — everywhere except
    // src/data and src/db must call a function in src/data/, not Kysely directly.
    files: ['src/**/*.ts'],
    ignores: ['src/data/**', 'src/db/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['kysely', 'kysely/*'],
              message: 'Kysely is data-layer only — call a function in src/data/ instead.',
            },
          ],
        },
      ],
    },
  },
];
