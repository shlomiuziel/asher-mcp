import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  // Base config
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.d.ts',
      'vitest.config.ts',
      'scripts/**',
      'eslint.config.js',
    ],
  },

  // JavaScript/TypeScript config
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // Recommended rules
      ...js.configs.recommended.rules,
      ...tsPlugin.configs['eslint-recommended'].rules,
      ...tsPlugin.configs['recommended'].rules,
      ...prettierConfig.rules,

      // Base rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-undef': 'off', // TypeScript handles this
      'no-unused-vars': 'off',
      'no-useless-escape': 'off',

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-require-imports': 'off',

      // Prettier integration
      'prettier/prettier': 'error',
    },
  },

  // Override for CLI tools, tests, and utility files where console statements are necessary
  {
    files: [
      '**/cli/**/*.{js,ts}',
      '**/tests/**/*.{js,ts}',
      '**/utils/cli.ts',
      '**/utils/consoleRedirect.ts',
      '**/utils/claudeConfig.ts',
      '**/mcp/Server.ts',
      '**/services/DatabaseService.ts',
      '**/services/EncryptionKeyService.ts',
      '**/services/ScraperService.ts',
    ],
    rules: {
      'no-console': 'off', // Allow all console statements in these files
    },
  },
];
