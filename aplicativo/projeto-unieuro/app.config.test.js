const appJson = require('./app.json');
const { BLOCKED_IN_DELIVERY, createConfig, isDeliveryBuild } = require('./app.config');

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
});
