import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const toWarn = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([name, value]) => {
      if (Array.isArray(value)) {
        return [name, ['warn', ...value.slice(1)]];
      }

      return [name, 'warn'];
    }),
  );

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'web/**',
      'scripts/probe-*.js',
    ],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...toWarn(js.configs.recommended.rules),
      ...toWarn(tsPlugin.configs.recommended.rules),
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['src/**/*.spec.ts'],
    rules: {
      // 단위 테스트 mock 캐스팅 — 구현 코드에는 동일 완화 적용하지 않음
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
