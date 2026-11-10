/**
 * Configuração dinâmica do Expo. Parte do `app.json` e muda só o que depende
 * do perfil de build do EAS.
 *
 * O APK de entrega (perfis `preview` e `production`) não declara a permissão
 * de internet nem as permissões que o modelo do Expo acrescenta sem uso (#63).
 * Sem a internet, nenhuma biblioteca consegue tirar dado do tablet (#16). O
 * build de desenvolvimento mantém tudo, porque precisa da rede para falar com
 * o Metro.
 *
 * A versão do APK vem da tag da release (#104): a esteira passa `APP_VERSION`
 * (por exemplo, `2.1.3`) e o Android recebe o mesmo nome de versão e um código
 * de versão que cresce a cada release. Sem a variável, vale o `app.json`.
 */
const DELIVERY_PROFILES = ['preview', 'production'];

const BLOCKED_IN_DELIVERY = [
  'android.permission.INTERNET',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.VIBRATE',
];

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

function isDeliveryBuild(env = process.env) {
  return DELIVERY_PROFILES.includes(env.EAS_BUILD_PROFILE);
}

/**
 * Código de versão do Android: MAJOR × 10000 + MINOR × 100 + PATCH (v2.1.3 vira
 * 20103). O tablet só aceita atualizar para um código maior, então ele nunca
 * pode diminuir. Por isso MINOR e PATCH ficam abaixo de 100: acima disso o
 * número repetiria o de outra versão.
 */
function versionCodeOf(versionName) {
  const match = VERSION_PATTERN.exec(versionName);
  if (!match) {
    throw new Error(`Versão "${versionName}" inválida: use MAJOR.MINOR.PATCH, como 2.1.3.`);
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  if (minor > 99 || patch > 99) {
    throw new Error(`Versão "${versionName}" inválida: MINOR e PATCH não passam de 99.`);
  }
  return major * 10000 + minor * 100 + patch;
}

function withVersion(config, env) {
  if (!env.APP_VERSION) return config;

  return {
    ...config,
    version: env.APP_VERSION,
    android: { ...config.android, versionCode: versionCodeOf(env.APP_VERSION) },
  };
}

function createConfig({ config: baseConfig }, env = process.env) {
  const config = withVersion(baseConfig, env);
  if (!isDeliveryBuild(env)) return config;

  return {
    ...config,
    android: {
      ...config.android,
      blockedPermissions: [...(config.android?.blockedPermissions ?? []), ...BLOCKED_IN_DELIVERY],
    },
  };
}

module.exports = (context) => createConfig(context);
module.exports.createConfig = createConfig;
module.exports.isDeliveryBuild = isDeliveryBuild;
module.exports.versionCodeOf = versionCodeOf;
module.exports.BLOCKED_IN_DELIVERY = BLOCKED_IN_DELIVERY;
