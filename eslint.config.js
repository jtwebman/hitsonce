import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// One-app ESLint config (HitsOnce is a single Worker). Config files are ESM .js;
// source is TypeScript. SQL never leaves the Store adapters in src/data/stores by
// convention — the rest of the app talks to the Store interface, not the backend.
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
];
