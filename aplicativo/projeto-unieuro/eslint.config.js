const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*'],
  },
  {
    files: [
      'src/app/**/*.{ts,tsx}',
      'src/features/**/*-screen.tsx',
      'src/features/**/*.styles.ts',
      'src/hooks/**/*.{ts,tsx}',
      'src/constants/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/db', '@/db/*', '**/db', '**/db/*', 'expo-sqlite', 'expo-sqlite/*'],
              message:
                'A camada de apresentação não acessa o banco. Use o módulo de composição da feature (ex.: @/features/auth/composition).',
            },
          ],
        },
      ],
    },
  },
]);
