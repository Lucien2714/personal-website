import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-config-prettier';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

/**
 * ESLint configuration.
 *
 * The rule set encodes the parts of the Google TypeScript Style Guide that a
 * linter can check mechanically: no `var`, `const` by default, documented
 * exports, no unused code, no implicit `any`. Formatting is delegated to
 * Prettier, which is why `eslint-config-prettier` is applied last and turns
 * off every stylistic rule that would otherwise fight it.
 *
 * Two ordering details are load-bearing:
 *
 *   * `nextCoreWebVitals` comes before the TypeScript block, because it sets
 *     its own parser and the type-aware rules need `@typescript-eslint/parser`
 *     to win.
 *   * Type-aware rules are scoped to `.ts`/`.tsx`. Applying them to this file,
 *     or to any other plain JavaScript, asks the type checker for information
 *     that does not exist and fails outright.
 *
 * ESLint is deliberately held at 9.x, which npm reports as deprecated on every
 * install. Do not "fix" that warning by bumping it: `@typescript-eslint/parser`
 * 8.x produces a scope manager without `ScopeManager.addGlobals`, which ESLint
 * 10 calls on every file, so linting dies with
 * `TypeError: scopeManager.addGlobals is not a function` before it checks
 * anything. typescript-eslint 8.68 advertises `eslint@^10` as a peer, but that
 * range is optimistic — the combination was tried and does not run. Both
 * parsers in play here (ours and the one `eslint-config-next` installs) are
 * that same package, so no configuration change avoids it.
 *
 * Revisit when typescript-eslint ships a release that genuinely supports
 * ESLint 10; the upgrade is then `eslint` and `@eslint/js` to `^10`, and a
 * regenerated lock file. ESLint runs only in CI and on a developer's machine —
 * it is a dev dependency and is not present in the runtime image — so the
 * deprecation notice carries no production risk in the meantime.
 */
export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      // Emitted by `prisma generate`; not ours to lint.
      'src/generated/**',
      'coverage/**',
    ],
  },

  js.configs.recommended,
  ...nextCoreWebVitals,

  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      jsdoc.configs['flat/recommended-typescript'],
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // --- Google TS Style Guide: language features -----------------------
      'no-var': 'error',
      'prefer-const': ['error', {destructuring: 'all'}],
      eqeqeq: ['error', 'always', {null: 'ignore'}],
      'no-throw-literal': 'off',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration[const=true]',
          message:
            'const enums are not supported under isolatedModules; use a union type or a plain object literal.',
        },
      ],

      // --- Documentation ---------------------------------------------------
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            MethodDefinition: true,
          },
          contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration'],
        },
      ],
      // The types already state what the parameters and the return value are;
      // the prose above a function should explain why it exists. Because
      // documenting parameters is optional here, checking that the list is
      // complete and correctly ordered would only punish partial docs.
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/check-param-names': 'off',
      'jsdoc/tag-lines': 'off',
      // Bulleted lists inside a comment are written with `*`, which this rule
      // reads as a stray second asterisk.
      'jsdoc/no-multi-asterisks': 'off',
    },
  },

  // CLI scripts run outside the Next.js bundler and report progress on stdout.
  {
    files: ['scripts/**/*.ts', 'prisma/**/*.ts'],
    rules: {
      'no-console': 'off',
      'jsdoc/require-jsdoc': 'off',
    },
  },

  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  prettier,
);
