const appJson = require('../../../app.json');
const {
  BLOCKED_IN_DELIVERY,
  createConfig,
  isDeliveryBuild,
  versionCodeOf,
} = require('../../../app.config');

const context = { config: appJson.expo };

describe('configuração por perfil de build', () => {
  it.each(['preview', 'production'])(
    'o APK do perfil %s não declara internet nem as permissões sem uso',
    (profile) => {
      const config = createConfig(context, { EAS_BUILD_PROFILE: profile });

      expect(config.android.blockedPermissions).toEqual(
        expect.arrayContaining([
          'android.permission.INTERNET',
          'android.permission.READ_EXTERNAL_STORAGE',
          'android.permission.WRITE_EXTERNAL_STORAGE',
          'android.permission.SYSTEM_ALERT_WINDOW',
          'android.permission.VIBRATE',
        ]),
      );
    },
  );

  it.each([
    ['de desenvolvimento', 'development'],
    ['local, sem perfil do EAS', undefined],
  ])('o build %s mantém a internet para falar com o Metro', (_build, profile) => {
    const config = createConfig(context, { EAS_BUILD_PROFILE: profile });

    expect(config.android.blockedPermissions).toBeUndefined();
    expect(isDeliveryBuild({ EAS_BUILD_PROFILE: profile })).toBe(false);
  });

  it('mantém o restante do app.json no build de entrega', () => {
    const config = createConfig(context, { EAS_BUILD_PROFILE: 'preview' });

    expect(config.android.package).toBe(appJson.expo.android.package);
    expect(config.plugins).toEqual(appJson.expo.plugins);
  });

  it('desliga o backup em qualquer perfil', () => {
    for (const profile of ['development', 'preview', 'production']) {
      const config = createConfig(context, { EAS_BUILD_PROFILE: profile });
      expect(config.android.allowBackup).toBe(false);
    }
  });

  it('aplica as regras de extração de dados em qualquer perfil', () => {
    expect(appJson.expo.plugins).toContain('./plugins/with-data-extraction-rules');
  });

  it('deixa as regras de backup só com o plugin do projeto', () => {
    expect(appJson.expo.plugins).toContainEqual([
      'expo-secure-store',
      { configureAndroidBackup: false },
    ]);
  });

  it('compila o SQLite com SQLCipher para cifrar o arquivo inteiro', () => {
    expect(appJson.expo.plugins).toContainEqual(['expo-sqlite', { useSQLCipher: true }]);
  });

  it('soma ao bloqueio que já estiver no app.json', () => {
    const config = createConfig(
      {
        config: { ...appJson.expo, android: { blockedPermissions: ['android.permission.CAMERA'] } },
      },
      { EAS_BUILD_PROFILE: 'production' },
    );

    expect(config.android.blockedPermissions).toEqual([
      'android.permission.CAMERA',
      ...BLOCKED_IN_DELIVERY,
    ]);
  });

  describe('versão do APK', () => {
    it('usa a versão da tag no nome e no código da versão', () => {
      const config = createConfig(context, { APP_VERSION: '2.1.3' });

      expect(config.version).toBe('2.1.3');
      expect(config.android.versionCode).toBe(20103);
    });

    it('mantém o restante do app.json ao aplicar a versão', () => {
      const config = createConfig(context, { APP_VERSION: '2.0.2', EAS_BUILD_PROFILE: 'preview' });

      expect(config.android.package).toBe(appJson.expo.android.package);
      expect(config.android.blockedPermissions).toEqual(BLOCKED_IN_DELIVERY);
    });

    it.each([undefined, ''])('sem a versão (%p) mantém a do app.json', (appVersion) => {
      const config = createConfig(context, { APP_VERSION: appVersion });

      expect(config.version).toBe(appJson.expo.version);
      expect(config.android.versionCode).toBeUndefined();
    });

    it.each(['v2.0.2', '2.0', '2.0.2-rc1', 'dois'])('recusa a versão inválida %s', (appVersion) => {
      expect(() => createConfig(context, { APP_VERSION: appVersion })).toThrow(
        /MAJOR\.MINOR\.PATCH/,
      );
    });
  });
});

describe('código da versão do Android', () => {
  it('cresce a cada release, mesmo quando o menor número passa de um dígito', () => {
    const versions = ['1.2.13', '2.0.0', '2.0.1', '2.0.2', '2.1.0', '2.10.0', '3.0.0'];
    const codes = versions.map(versionCodeOf);

    expect(codes).toEqual([...codes].sort((a, b) => a - b));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('calcula MAJOR × 10000 + MINOR × 100 + PATCH', () => {
    expect(versionCodeOf('1.2.13')).toBe(10213);
    expect(versionCodeOf('2.0.0')).toBe(20000);
  });

  it('é maior que o código 1 dos APKs que saíram até a v2.0.2', () => {
    expect(versionCodeOf('2.0.3')).toBeGreaterThan(1);
  });

  it.each(['2.100.0', '2.0.100'])(
    'recusa %s, que repetiria o código de outra versão',
    (version) => {
      expect(() => versionCodeOf(version)).toThrow(/99/);
    },
  );
});
