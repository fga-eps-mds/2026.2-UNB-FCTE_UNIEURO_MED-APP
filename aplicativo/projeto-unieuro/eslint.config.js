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

module.exports = defineConfig([
  expoConfig,
  {
    // Saídas geradas: build, relatórios de teste e cache do Expo.
    ignores: ['dist/*', 'coverage/*', '.expo/*'],
  },
]);
