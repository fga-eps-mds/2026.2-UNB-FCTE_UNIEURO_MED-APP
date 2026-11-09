const withReleaseSigning = require('../../../plugins/with-release-signing');

const { applyReleaseSigning, MARKER } = withReleaseSigning;

// Trecho do app/build.gradle que `expo prebuild` gera, como no modelo do Expo SDK 57.
const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

describe('assinatura do APK de release', () => {
  it('cria a assinatura release com as variáveis de ambiente da esteira', () => {
    const gradle = applyReleaseSigning(TEMPLATE);

    expect(gradle).toContain("storeFile file(System.getenv('MED_KEYSTORE_PATH'))");
    expect(gradle).toContain("storePassword System.getenv('MED_KEYSTORE_PASSWORD')");
    expect(gradle).toContain("keyAlias System.getenv('MED_KEY_ALIAS')");
    expect(gradle).toContain("keyPassword System.getenv('MED_KEY_PASSWORD')");
  });

  it('assina o release com a chave do MED quando ela existe e com a de debug quando não', () => {
    const gradle = applyReleaseSigning(TEMPLATE);
    const release = gradle.split('buildTypes {')[1].split('release {')[1];

    expect(release).toContain(
      "signingConfig System.getenv('MED_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug",
    );
  });

  it('não muda a assinatura do build de debug', () => {
    const gradle = applyReleaseSigning(TEMPLATE);
    const debug = gradle.split('buildTypes {')[1].split('release {')[0];

    expect(debug).toContain('signingConfig signingConfigs.debug');
    expect(gradle).toContain("storeFile file('debug.keystore')");
  });

  it('não grava senha nem caminho de chave no arquivo', () => {
    const release = applyReleaseSigning(TEMPLATE).split('release {')[1].split('buildTypes {')[0];

    expect(release).not.toMatch(/Password '/);
    expect(release).not.toMatch(/storeFile file\('/);
  });

  it('aplicar duas vezes dá o mesmo resultado', () => {
    const once = applyReleaseSigning(TEMPLATE);

    expect(applyReleaseSigning(once)).toBe(once);
    expect(once.split(MARKER)).toHaveLength(2);
  });

  it('falha em vez de seguir com a chave de debug quando o modelo do Gradle muda', () => {
    expect(() => applyReleaseSigning('android {\n    buildTypes {\n    }\n}\n')).toThrow(
      /build\.gradle/,
    );
    expect(() =>
      applyReleaseSigning(
        TEMPLATE.replace('signingConfig signingConfigs.debug\n            minify', 'minify'),
      ),
    ).toThrow(/build\.gradle/);
  });

  it('registra a alteração do build.gradle', () => {
    const config = withReleaseSigning({ name: 'med', slug: 'med' });

    expect(config.mods.android.appBuildGradle).toEqual(expect.any(Function));
  });
});
