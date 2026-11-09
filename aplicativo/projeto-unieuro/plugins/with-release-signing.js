/**
 * Plugin de configuração do Expo que assina o APK de release com a chave do MED
 * (#104).
 *
 * O projeto Android que o `expo prebuild` gera assina o release com a chave de
 * debug do modelo do React Native, a mesma de qualquer projeto: qualquer pessoa
 * poderia assinar um APK com o pacote do MED e instalá-lo por cima, ficando com
 * os dados e com a chave do Keystore que protege o CPF. Aqui o release passa a
 * usar a chave que a esteira entrega por variáveis de ambiente, sem gravar
 * senha nem caminho no projeto. Sem as variáveis (build local), continua a
 * chave de debug.
 *
 * Se o modelo do `build.gradle` mudar e o plugin não achar onde atuar, ele
 * falha: seguir em silêncio entregaria um APK com a chave de debug.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// Assinatura do release pelo MED (#104).';

const RELEASE_SIGNING_CONFIG = `$1        release {
            ${MARKER}
            if (System.getenv('MED_KEYSTORE_PATH')) {
                storeFile file(System.getenv('MED_KEYSTORE_PATH'))
                storePassword System.getenv('MED_KEYSTORE_PASSWORD')
                keyAlias System.getenv('MED_KEY_ALIAS')
                keyPassword System.getenv('MED_KEY_PASSWORD')
            }
        }
`;

const DEBUG_SIGNING_CONFIG = /(signingConfigs \{\s*debug \{[^}]*\}\n)/;
const RELEASE_BUILD_TYPE =
  /(buildTypes \{[\s\S]*?release \{[^}]*?)signingConfig signingConfigs\.debug/;

function applyReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  if (!DEBUG_SIGNING_CONFIG.test(gradle) || !RELEASE_BUILD_TYPE.test(gradle)) {
    throw new Error(
      'with-release-signing: o build.gradle gerado pelo Expo mudou e o plugin não achou onde ' +
        'trocar a assinatura do release. Ajuste plugins/with-release-signing.js.',
    );
  }

  return gradle
    .replace(
      RELEASE_BUILD_TYPE,
      (_all, before) =>
        `${before}signingConfig System.getenv('MED_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug`,
    )
    .replace(DEBUG_SIGNING_CONFIG, (_all, debugBlock) =>
      RELEASE_SIGNING_CONFIG.replace('$1', () => debugBlock),
    );
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = applyReleaseSigning(modConfig.modResults.contents);
    return modConfig;
  });
}

module.exports = withReleaseSigning;
module.exports.applyReleaseSigning = applyReleaseSigning;
module.exports.MARKER = MARKER;
