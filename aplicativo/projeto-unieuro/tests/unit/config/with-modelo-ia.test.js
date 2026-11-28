const crypto = require('crypto');
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
const CONTEUDO = Buffer.alloc(1234, 7);

function manifestoDe(conteudo, alteracoes = {}) {
  return {
    versao: 'vgg16-teste-v1',
    url: 'https://example.org/modelo.onnx',
    sha256: crypto.createHash('sha256').update(conteudo).digest('hex'),
    bytes: conteudo.length,
    ...alteracoes,
  };
}

let pasta;

beforeEach(async () => {
  pasta = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'med-modelo-'));
});

afterEach(async () => {
  await fs.promises.rm(pasta, { recursive: true, force: true });
});

async function gravar(nome, conteudo) {
  const caminho = path.join(pasta, nome);
  await fs.promises.writeFile(caminho, conteudo);
  return caminho;
}

describe('modelo de IA no APK', () => {
  it('sem MED_MODELO_ONNX, o APK sai sem o modelo e o build não muda', () => {
    const config = { name: 'app' };

    expect(withModeloIa(config, {})).toBe(config);
    expect(appJson.expo.plugins).toContain('./plugins/with-modelo-ia');
  });

  it('copia o modelo do manifesto para os assets com a versão e o tamanho, sem compressão', async () => {
    const arquivo = await gravar('modelo.onnx', CONTEUDO);
    const manifesto = await gravar('modelo-ia.json', JSON.stringify(manifestoDe(CONTEUDO)));
    const projeto = path.join(pasta, 'android');
    const config = withModeloIa({}, { MED_MODELO_ONNX: arquivo }, manifesto);

    await config.dangerous.action({ modRequest: { platformProjectRoot: projeto } });
    const assets = path.join(projeto, 'app', 'src', 'main', 'assets', 'modelo');
    const gradle = config.gradle({ modResults: { contents: GRADLE } }).modResults.contents;

    expect(config.dangerous.platform).toBe('android');
    expect(
      JSON.parse(await fs.promises.readFile(path.join(assets, 'modelo.json'), 'utf8')),
    ).toEqual({ versao: 'vgg16-teste-v1', bytes: 1234 });
    expect((await fs.promises.stat(path.join(assets, 'modelo.onnx'))).size).toBe(1234);
    expect(gradle).toContain("noCompress += ['onnx']");
    expect(withModeloIa.semCompressao(gradle)).toBe(gradle);
  });

  it.each([
    ['o arquivo não existe', 'falta.onnx', CONTEUDO, 'não existe'],
    ['o tamanho não bate', 'modelo.onnx', Buffer.alloc(1233, 7), 'não é o modelo'],
    ['o SHA-256 não bate', 'modelo.onnx', Buffer.alloc(1234, 8), 'não é o modelo'],
  ])('para o build se %s', async (_cenario, nome, conteudo, erro) => {
    await gravar('modelo.onnx', conteudo);
    const projeto = path.join(pasta, 'android');

    await expect(
      withModeloIa.copiarModelo(projeto, path.join(pasta, nome), manifestoDe(CONTEUDO)),
    ).rejects.toThrow(erro);
    expect(fs.existsSync(projeto)).toBe(false);
  });

  it.each([
    ['a versão vira caminho', { versao: '../../banco' }, 'inválida'],
    ['falta o SHA-256', { sha256: undefined }, 'SHA-256'],
    ['o tamanho não é um número inteiro', { bytes: '1234' }, 'tamanho'],
  ])('recusa o manifesto quando %s', async (_cenario, alteracoes, erro) => {
    const manifesto = await gravar(
      'modelo-ia.json',
      JSON.stringify(manifestoDe(CONTEUDO, alteracoes)),
    );

    expect(() => withModeloIa.lerManifesto(manifesto)).toThrow(erro);
  });

  it('o manifesto do repositório aponta um modelo com versão, endereço, SHA-256 e tamanho', () => {
    const manifesto = withModeloIa.lerManifesto();

    expect(manifesto.url).toMatch(/^https:\/\//);
    expect(manifesto.url).toContain(manifesto.versao);
  });
});
