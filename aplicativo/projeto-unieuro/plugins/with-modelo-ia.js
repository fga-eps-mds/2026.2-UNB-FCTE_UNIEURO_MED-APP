/**
 * Põe o modelo de IA dentro do APK (#12), sem que ele entre no repositório.
 *
 * O `.onnx` tem cerca de 185 MB e deriva do conjunto de dados, por isso não é versionado (IA,
 * docs/exportacao-do-modelo.md). O build recebe o caminho do arquivo em `MED_MODELO_ONNX`, e o
 * plugin copia o modelo para `assets/modelo/` com a descrição `modelo.json` (versão e tamanho),
 * que o aplicativo usa para saber se a cópia no tablet está inteira. Sem a variável, o APK sai
 * sem o modelo e a análise avisa que ele não foi incluído.
 *
 * O Android comprime os assets por padrão; o modelo fica sem compressão para a cópia ser rápida.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

const PASTA_NOS_ASSETS = path.join('app', 'src', 'main', 'assets', 'modelo');
const VERSAO_SEGURA = /^[A-Za-z0-9._-]+$/;
const MARCA_DO_GRADLE = '// with-modelo-ia: modelo sem compressão';

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

async function copiarModelo(projetoAndroid, origem, versaoPedida) {
  if (!fs.existsSync(origem)) {
    throw new Error(`MED_MODELO_ONNX aponta para um arquivo que não existe: ${origem}`);
  }
  const versao = versaoPedida || `modelo-${(await resumoDoArquivo(origem)).slice(0, 12)}`;
  if (!VERSAO_SEGURA.test(versao)) {
    throw new Error(
      `MED_MODELO_VERSAO "${versao}" inválida: use letras, números, ponto, hífen ou _.`,
    );
  }
  const destino = path.join(projetoAndroid, PASTA_NOS_ASSETS);
  await fs.promises.mkdir(destino, { recursive: true });
  await fs.promises.copyFile(origem, path.join(destino, 'modelo.onnx'));
  const { size } = await fs.promises.stat(origem);
  await fs.promises.writeFile(
    path.join(destino, 'modelo.json'),
    `${JSON.stringify({ versao, bytes: size })}\n`,
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

module.exports = function withModeloIa(config, env = process.env) {
  const origem = env.MED_MODELO_ONNX;
  if (!origem) return config;

  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      await copiarModelo(modConfig.modRequest.platformProjectRoot, origem, env.MED_MODELO_VERSAO);
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
