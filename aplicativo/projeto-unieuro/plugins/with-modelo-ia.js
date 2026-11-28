/**
 * Põe o modelo de IA dentro do APK (#12), sem que ele entre no repositório.
 *
 * O `.onnx` tem cerca de 185 MB, acima do limite de arquivo do GitHub, por isso não é versionado
 * (IA, docs/exportacao-do-modelo.md). O manifesto `modelo-ia.json` diz qual modelo vai no APK
 * (#151): a versão, o endereço de onde o pipeline baixa o arquivo, o SHA-256 e o tamanho. O build
 * recebe o caminho do arquivo em `MED_MODELO_ONNX`, e o plugin só o copia para `assets/modelo/` se
 * ele for o do manifesto, para que o APK local e o do pipeline levem o mesmo modelo. A descrição
 * `modelo.json` (versão e tamanho) é o que o aplicativo usa para saber se a cópia no tablet está
 * inteira. Sem a variável, o APK sai sem o modelo e a análise avisa que ele não foi incluído.
 *
 * O Android comprime os assets por padrão; o modelo fica sem compressão para a cópia ser rápida.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

const MANIFESTO = path.join(__dirname, '..', 'modelo-ia.json');
const PASTA_NOS_ASSETS = path.join('app', 'src', 'main', 'assets', 'modelo');
const VERSAO_SEGURA = /^[A-Za-z0-9._-]+$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MARCA_DO_GRADLE = '// with-modelo-ia: modelo sem compressão';

function lerManifesto(caminho = MANIFESTO) {
  const manifesto = JSON.parse(fs.readFileSync(caminho, 'utf8'));
  if (!VERSAO_SEGURA.test(manifesto.versao ?? '')) {
    throw new Error(
      `Versão "${manifesto.versao}" inválida no modelo-ia.json: use letras, números, ponto, hífen ou _.`,
    );
  }
  if (!SHA256.test(manifesto.sha256 ?? '')) {
    throw new Error('O modelo-ia.json precisa do SHA-256 do modelo, em 64 dígitos hexadecimais.');
  }
  if (!Number.isInteger(manifesto.bytes) || manifesto.bytes <= 0) {
    throw new Error('O modelo-ia.json precisa do tamanho do modelo em bytes.');
  }
  return manifesto;
}

async function resumoDoArquivo(caminho) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    fs.createReadStream(caminho)
      .on('data', (parte) => hash.update(parte))
      .on('end', resolve)
      .on('error', reject);
  });
  return hash.digest('hex');
}

async function conferirModelo(origem, manifesto) {
  if (!fs.existsSync(origem)) {
    throw new Error(`MED_MODELO_ONNX aponta para um arquivo que não existe: ${origem}`);
  }
  const { size } = await fs.promises.stat(origem);
  const resumo = size === manifesto.bytes ? await resumoDoArquivo(origem) : null;
  if (resumo !== manifesto.sha256) {
    throw new Error(
      `O arquivo de MED_MODELO_ONNX não é o modelo ${manifesto.versao} do modelo-ia.json ` +
        '(o tamanho ou o SHA-256 não bate).',
    );
  }
}

async function copiarModelo(projetoAndroid, origem, manifesto) {
  await conferirModelo(origem, manifesto);
  const destino = path.join(projetoAndroid, PASTA_NOS_ASSETS);
  await fs.promises.mkdir(destino, { recursive: true });
  await fs.promises.copyFile(origem, path.join(destino, 'modelo.onnx'));
  await fs.promises.writeFile(
    path.join(destino, 'modelo.json'),
    `${JSON.stringify({ versao: manifesto.versao, bytes: manifesto.bytes })}\n`,
  );
}

function semCompressao(gradle) {
  if (gradle.includes(MARCA_DO_GRADLE)) return gradle;
  return gradle.replace(
    /^android\s*\{/m,
    (abertura) =>
      `${abertura}\n    ${MARCA_DO_GRADLE}\n    androidResources {\n        noCompress += ['onnx']\n    }`,
  );
}

module.exports = function withModeloIa(config, env = process.env, caminhoDoManifesto = MANIFESTO) {
  const origem = env.MED_MODELO_ONNX;
  if (!origem) return config;
  const manifesto = lerManifesto(caminhoDoManifesto);

  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      await copiarModelo(modConfig.modRequest.platformProjectRoot, origem, manifesto);
      return modConfig;
    },
  ]);
  return withAppBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = semCompressao(modConfig.modResults.contents);
    return modConfig;
  });
};

module.exports.semCompressao = semCompressao;
module.exports.copiarModelo = copiarModelo;
module.exports.lerManifesto = lerManifesto;
