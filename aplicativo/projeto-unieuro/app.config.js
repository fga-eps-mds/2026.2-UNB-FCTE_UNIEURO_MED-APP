/**
 * Configuração dinâmica do Expo. Parte do `app.json` e muda só o que depende
 * do perfil de build do EAS.
 *
 * O APK de entrega (perfis `preview` e `production`) não declara a permissão
 * de internet nem as permissões que o modelo do Expo acrescenta sem uso (#63).
 * Sem a internet, nenhuma biblioteca consegue tirar dado do tablet (#16). O
 * build de desenvolvimento mantém tudo, porque precisa da rede para falar com
 * o Metro.
 */
const DELIVERY_PROFILES = ['preview', 'production'];

const BLOCKED_IN_DELIVERY = [
  'android.permission.INTERNET',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.VIBRATE',
];

function isDeliveryBuild(env = process.env) {
  return DELIVERY_PROFILES.includes(env.EAS_BUILD_PROFILE);
}

function createConfig({ config }, env = process.env) {
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
module.exports.BLOCKED_IN_DELIVERY = BLOCKED_IN_DELIVERY;
