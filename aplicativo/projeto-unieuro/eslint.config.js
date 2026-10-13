/**
 * Configuração do ESLint, baseada na recomendada pelo Expo:
 * https://docs.expo.dev/guides/using-eslint/
 *
 * O pipeline roda `npm run lint -- --max-warnings 0`, então aviso também reprova o
 * build. Corrija o aviso em vez de desligar a regra; se a regra realmente não se
 * aplicar, desligue só na linha, com um comentário explicando o motivo.
 */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
// Desliga as regras de estilo que o Prettier já resolve, para as duas ferramentas não brigarem.
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Saídas geradas: build, relatórios de teste e cache do Expo.
    ignores: ['dist/*', 'coverage/*', '.expo/*'],
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
  prettierConfig,
]);
