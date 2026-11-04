import next from 'eslint-config-next';

/**
 * Flat ESLint config (ESLint 9+, native `eslint-config-next` flat export).
 *
 * `npm run lint` must work unattended — v1 had no config at all, so
 * `next lint` opened an interactive setup prompt and hung in CI.
 */
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      'next-env.d.ts',
      'package-lock.json',
    ],
  },
  ...next,
  {
    // Scoped to TS files so the plugin registered by eslint-config-next applies.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // The whole point of `strict` in tsconfig — do not let it leak back in.
      '@typescript-eslint/no-explicit-any': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
    },
  },
  {
    // Tests and tooling may print to the console.
    files: ['tests/**/*.ts', 'scripts/**/*.mjs', '*.config.ts', '*.config.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
];

export default eslintConfig;
