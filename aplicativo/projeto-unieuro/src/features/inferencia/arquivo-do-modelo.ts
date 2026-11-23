/**
 * Arquivo do modelo de IA no tablet (#12).
 *
 * O `.onnx` vai dentro do APK, em `assets/modelo/`, com a descrição `modelo.json` gerada no
 * build (`plugins/with-modelo-ia.js`). O ONNX Runtime só abre o modelo por um caminho de arquivo,
 * e os assets do APK não têm caminho, então o arquivo é copiado uma vez para a pasta do
 * aplicativo. A cópia leva o nome da versão: um APK com outro modelo copia o novo e apaga o antigo.
 */

export const PASTA_DO_MODELO = 'modelo';
export const DESCRICAO_EMPACOTADA = 'modelo/modelo.json';
export const MODELO_EMPACOTADO = 'modelo/modelo.onnx';

export type DescricaoDoModelo = { versao: string; bytes: number };

/** O que o arquivo do modelo precisa do sistema de arquivos. A implementação real usa o Expo. */
export type ArquivosDoAparelho = {
  /** Texto de um arquivo empacotado no APK, ou `null` se ele não existe. */
  lerEmpacotado(caminho: string): Promise<string | null>;
  /** Tamanho em bytes de um arquivo na pasta do aplicativo, ou `null` se ele não existe. */
  tamanhoLocal(caminho: string): number | null;
  /** Arquivos da pasta do aplicativo. */
  listarLocais(pasta: string): string[];
  copiarEmpacotado(origem: string, destino: string): Promise<void>;
  moverLocal(origem: string, destino: string): Promise<void>;
  apagarLocal(caminho: string): void;
  /** Endereço `file://` de um arquivo da pasta do aplicativo. */
  enderecoLocal(caminho: string): string;
};

export class ModeloAusenteError extends Error {
  constructor() {
    super('Este APK foi gerado sem o arquivo do modelo de IA.');
    this.name = 'ModeloAusenteError';
  }
}

const VERSAO_SEGURA = /^[A-Za-z0-9._-]+$/;

function lerDescricao(texto: string): DescricaoDoModelo {
  const descricao = JSON.parse(texto) as Partial<DescricaoDoModelo>;
  const versaoValida = typeof descricao.versao === 'string' && VERSAO_SEGURA.test(descricao.versao);
  const bytesValidos = Number.isInteger(descricao.bytes) && (descricao.bytes ?? 0) > 0;
  if (!versaoValida || !bytesValidos) {
    throw new Error('A descrição do modelo empacotado está incompleta.');
  }
  return { versao: descricao.versao as string, bytes: descricao.bytes as number };
}

export type ModeloNoAparelho = { endereco: string; versao: string };

export async function prepararArquivoDoModelo(
  arquivos: ArquivosDoAparelho,
): Promise<ModeloNoAparelho> {
  const texto = await arquivos.lerEmpacotado(DESCRICAO_EMPACOTADA);
  if (texto === null) throw new ModeloAusenteError();
  const { versao, bytes } = lerDescricao(texto);

  const destino = `${PASTA_DO_MODELO}/${versao}.onnx`;
  if (arquivos.tamanhoLocal(destino) !== bytes) {
    // A cópia vai para um nome provisório e só depois para o nome final: se o aplicativo
    // fechar no meio, o próximo uso não abre um arquivo pela metade.
    const provisorio = `${destino}.copiando`;
    arquivos.apagarLocal(provisorio);
    await arquivos.copiarEmpacotado(MODELO_EMPACOTADO, provisorio);
    if (arquivos.tamanhoLocal(provisorio) !== bytes) {
      arquivos.apagarLocal(provisorio);
      throw new Error('A cópia do modelo para o tablet ficou incompleta.');
    }
    arquivos.apagarLocal(destino);
    await arquivos.moverLocal(provisorio, destino);
  }

  // O modelo tem cerca de 185 MB; uma versão antiga esquecida ocuparia o mesmo espaço.
  for (const arquivo of arquivos.listarLocais(PASTA_DO_MODELO)) {
    if (arquivo !== `${versao}.onnx`) arquivos.apagarLocal(`${PASTA_DO_MODELO}/${arquivo}`);
  }
  return { endereco: arquivos.enderecoLocal(destino), versao };
}
