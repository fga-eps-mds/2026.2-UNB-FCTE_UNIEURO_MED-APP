const fs = require('node:fs');
const path = require('node:path');

const appJson = require('../../../app.json');
const packageJson = require('../../../package.json');
const { BLOCKED_IN_DELIVERY, createConfig } = require('../../../app.config');

/**
 * #16: nenhum dado sai do tablet. Este arquivo fecha os caminhos que o guarda de
 * rede dos testes (`tests/test-support/sem-rede.ts`) não alcança: o código-fonte,
 * as bibliotecas embarcadas e as permissões do APK de entrega.
 */

const RAIZ = path.resolve(__dirname, '../../..');

function arquivosDe(pasta) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivosDe(caminho);
    return /\.(ts|tsx|js|jsx)$/.test(entrada.name) ? [caminho] : [];
  });
}

// Comentários e textos de ajuda podem citar "fetch" ou uma URL sem chamar nada.
function semComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CAMINHOS_DE_SAIDA = [
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['Linking.openURL', /\bopenURL\s*\(/],
  ['expo-web-browser', /\bopenBrowserAsync\s*\(/],
];

// Serviços de métrica, relatório de erro, atualização remota e transporte de dados.
const BIBLIOTECAS_DE_REDE =
  /sentry|bugsnag|crashlytics|firebase|analytics|amplitude|mixpanel|segment|posthog|datadog|appcenter|instabug|logrocket|rollbar|newrelic|onesignal|expo-updates|expo-notifications|expo-network|expo-dev-client|netinfo|axios|socket\.io|apollo|urql|react-query|reactotron|flipper|nearby|bluetooth|react-native-(ble|wifi|tcp|udp)/i;

describe('o aplicativo não envia dado para fora do tablet (#16)', () => {
  describe('código-fonte', () => {
    const arquivos = arquivosDe(path.join(RAIZ, 'src'));

    it('encontra os arquivos do aplicativo', () => {
      expect(arquivos.length).toBeGreaterThan(50);
    });

    it.each(CAMINHOS_DE_SAIDA)('nenhum arquivo usa %s', (_nome, padrao) => {
      const usos = arquivos
        .filter((arquivo) => padrao.test(semComentarios(fs.readFileSync(arquivo, 'utf8'))))
        .map((arquivo) => path.relative(RAIZ, arquivo));

      expect(usos).toEqual([]);
    });

    it('nenhum arquivo importa biblioteca de rede, de métrica ou de relatório de erro', () => {
      const importacoes = arquivos.flatMap((arquivo) => {
        const codigo = semComentarios(fs.readFileSync(arquivo, 'utf8'));
        const modulos = [...codigo.matchAll(/(?:from|require\()\s*['"]([^'"]+)['"]/g)].map(
          (achado) => achado[1],
        );
        return modulos
          .filter((modulo) => BIBLIOTECAS_DE_REDE.test(modulo))
          .map((modulo) => `${path.relative(RAIZ, arquivo)} → ${modulo}`);
      });

      expect(importacoes).toEqual([]);
    });
  });

  describe('bibliotecas embarcadas', () => {
    it('nenhuma dependência de execução envia dado ou atualiza o aplicativo pela rede', () => {
      const embarcadas = Object.keys(packageJson.dependencies);

      expect(embarcadas.filter((nome) => BIBLIOTECAS_DE_REDE.test(nome))).toEqual([]);
    });

    it('o reconhecedor de bibliotecas pega os serviços que a regra de negócio proíbe', () => {
      for (const nome of [
        '@sentry/react-native',
        '@react-native-firebase/analytics',
        'expo-updates',
        'axios',
        'react-native-ble-plx',
        '@react-native-community/netinfo',
      ]) {
        expect(BIBLIOTECAS_DE_REDE.test(nome)).toBe(true);
      }
      for (const nome of ['expo-sqlite', 'expo-secure-store', 'react-native-reanimated']) {
        expect(BIBLIOTECAS_DE_REDE.test(nome)).toBe(false);
      }
    });
  });

  describe('configuração do APK', () => {
    it('não liga a atualização remota do aplicativo', () => {
      expect(appJson.expo.updates).toBeUndefined();
      expect(appJson.expo.runtimeVersion).toBeUndefined();
    });

    it('não declara permissão por conta própria: só o bloqueio decide o que o APK recebe', () => {
      expect(appJson.expo.android.permissions).toBeUndefined();
    });

    it.each(['preview', 'production'])(
      'o APK do perfil %s sai sem a permissão de internet',
      (perfil) => {
        const config = createConfig({ config: appJson.expo }, { EAS_BUILD_PROFILE: perfil });

        expect(config.android.blockedPermissions).toContain('android.permission.INTERNET');
        expect(BLOCKED_IN_DELIVERY).toContain('android.permission.INTERNET');
      },
    );

    it('nenhum plugin do Expo acrescenta a permissão de internet por conta própria', () => {
      const plugins = appJson.expo.plugins.map((plugin) =>
        Array.isArray(plugin) ? plugin[0] : plugin,
      );

      expect(plugins.filter((plugin) => BIBLIOTECAS_DE_REDE.test(plugin))).toEqual([]);
    });
  });
});
