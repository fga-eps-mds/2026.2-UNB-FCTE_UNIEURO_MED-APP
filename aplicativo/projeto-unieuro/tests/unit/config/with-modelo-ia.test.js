const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('expo/config-plugins', () => ({
  withDangerousMod: (config, [platform, action]) => ({
    ...config,
    dangerous: { platform, action },
  }),
  withAppBuildGradle: (config, action) => ({ ...config, gradle: action }),
}));

const withModeloIa = require('../../../plugins/with-modelo-ia');
const appJson = require('../../../app.json');

const GRADLE = 'apply plugin: "com.android.application"\n\nandroid {\n    namespace "x"\n}\n';

async function pastaTemporaria(prefixo) {
  return fs.promises.mkdtemp(path.join(os.tmpdir(), prefixo));
}

describe('modelo de IA no APK', () => {
  it('sem MED_MODELO_ONNX, o APK sai sem o modelo e o build não muda', () => {
    const config = { name: 'app' };

    expect(withModeloIa(config, {})).toBe(config);
    expect(appJson.expo.plugins).toContain('./plugins/with-modelo-ia');
  });

  it('copia o modelo para os assets com a versão e o tamanho, e o deixa sem compressão', async () => {
    const origem = await pastaTemporaria('med-modelo-');
    const projeto = await pastaTemporaria('med-android-');
    try {
      const arquivo = path.join(origem, 'modelo.onnx');
      await fs.promises.writeFile(arquivo, Buffer.alloc(1234, 7));
      const config = withModeloIa({}, { MED_MODELO_ONNX: arquivo, MED_MODELO_VERSAO: 'v1.6' });

      await config.dangerous.action({ modRequest: { platformProjectRoot: projeto } });
      const assets = path.join(projeto, 'app', 'src', 'main', 'assets', 'modelo');
      const gradle = config.gradle({ modResults: { contents: GRADLE } }).modResults.contents;

      expect(config.dangerous.platform).toBe('android');
      expect(
        JSON.parse(await fs.promises.readFile(path.join(assets, 'modelo.json'), 'utf8')),
      ).toEqual({
        versao: 'v1.6',
        bytes: 1234,
      });
      expect((await fs.promises.stat(path.join(assets, 'modelo.onnx'))).size).toBe(1234);
      expect(gradle).toContain("noCompress += ['onnx']");
      expect(withModeloIa.semCompressao(gradle)).toBe(gradle);
    } finally {
      await fs.promises.rm(origem, { recursive: true, force: true });
      await fs.promises.rm(projeto, { recursive: true, force: true });
    }
  });

  it('sem versão informada, usa o começo do SHA-256 do arquivo', async () => {
    const origem = await pastaTemporaria('med-modelo-');
    const projeto = await pastaTemporaria('med-android-');
    try {
      const arquivo = path.join(origem, 'modelo.onnx');
      await fs.promises.writeFile(arquivo, 'abc');

      await withModeloIa.copiarModelo(projeto, arquivo);

      const descricao = JSON.parse(
        await fs.promises.readFile(
          path.join(projeto, 'app', 'src', 'main', 'assets', 'modelo', 'modelo.json'),
          'utf8',
        ),
      );
      // SHA-256 de "abc".
      expect(descricao.versao).toBe('modelo-ba7816bf8f01');
    } finally {
      await fs.promises.rm(origem, { recursive: true, force: true });
      await fs.promises.rm(projeto, { recursive: true, force: true });
    }
  });

  it('para o build se o arquivo não existe ou se a versão vira caminho', async () => {
    const projeto = await pastaTemporaria('med-android-');
    const origem = await pastaTemporaria('med-modelo-');
    try {
      const arquivo = path.join(origem, 'modelo.onnx');
      await fs.promises.writeFile(arquivo, 'abc');

      await expect(
        withModeloIa.copiarModelo(projeto, path.join(origem, 'falta.onnx')),
      ).rejects.toThrow('não existe');
      await expect(withModeloIa.copiarModelo(projeto, arquivo, '../../banco')).rejects.toThrow(
        'inválida',
      );
    } finally {
      await fs.promises.rm(projeto, { recursive: true, force: true });
      await fs.promises.rm(origem, { recursive: true, force: true });
    }
  });
});
