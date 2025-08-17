// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'coverage',
      'dist',
      'docs/js/fast-grid-layout.js',
      'node_modules',
      'test-results',
    ],
  },
);
