import {
  DESCRICAO_EMPACOTADA,
  MODELO_EMPACOTADO,
  ModeloAusenteError,
  prepararArquivoDoModelo,
  type ArquivosDoAparelho,
} from '@/features/inferencia/arquivo-do-modelo';

const BYTES = 1200;
const DESCRICAO = JSON.stringify({ versao: 'vgg16-semente1-v1.6', bytes: BYTES });

/** Sistema de arquivos em memória: o APK com o que foi empacotado e a pasta do aplicativo. */
function aparelho(
  empacotados: Record<string, string | number>,
  locais: Record<string, number> = {},
) {
  const pasta = new Map(Object.entries(locais));
  let tamanhoDaCopia: number | undefined;
  const arquivos: ArquivosDoAparelho = {
    lerEmpacotado: jest.fn(async (caminho: string) => {
      const conteudo = empacotados[caminho];
      return typeof conteudo === 'string' ? conteudo : null;
    }),
    tamanhoLocal: (caminho) => pasta.get(caminho) ?? null,
    listarLocais: (diretorio) =>
      [...pasta.keys()]
        .filter((caminho) => caminho.startsWith(`${diretorio}/`))
        .map((caminho) => caminho.slice(diretorio.length + 1)),
    copiarEmpacotado: jest.fn(async (origem: string, destino: string) => {
      pasta.set(destino, tamanhoDaCopia ?? Number(empacotados[origem]));
    }),
    moverLocal: jest.fn(async (origem: string, destino: string) => {
      pasta.set(destino, pasta.get(origem)!);
      pasta.delete(origem);
    }),
    apagarLocal: (caminho) => {
      pasta.delete(caminho);
    },
    enderecoLocal: (caminho) => `file:///data/app/files/${caminho}`,
  };
  return {
    arquivos,
    pasta,
    copiaIncompleta: (tamanho: number) => {
      tamanhoDaCopia = tamanho;
    },
  };
}

const COM_MODELO = { [DESCRICAO_EMPACOTADA]: DESCRICAO, [MODELO_EMPACOTADO]: BYTES };

describe('arquivo do modelo no tablet', () => {
  it('copia o modelo do APK uma vez e devolve o endereço e a versão', async () => {
    const { arquivos, pasta } = aparelho(COM_MODELO);

    await expect(prepararArquivoDoModelo(arquivos)).resolves.toEqual({
      endereco: 'file:///data/app/files/modelo/vgg16-semente1-v1.6.onnx',
      versao: 'vgg16-semente1-v1.6',
    });
    expect([...pasta.keys()]).toEqual(['modelo/vgg16-semente1-v1.6.onnx']);
  });

  it('não copia de novo quando o arquivo da versão já está inteiro no tablet', async () => {
    const { arquivos } = aparelho(COM_MODELO, { 'modelo/vgg16-semente1-v1.6.onnx': BYTES });

    await prepararArquivoDoModelo(arquivos);

    expect(arquivos.copiarEmpacotado).not.toHaveBeenCalled();
  });

  it('copia de novo um arquivo pela metade, de uma cópia interrompida', async () => {
    const { arquivos, pasta } = aparelho(COM_MODELO, {
      'modelo/vgg16-semente1-v1.6.onnx': 300,
      'modelo/vgg16-semente1-v1.6.onnx.copiando': 500,
    });

    await prepararArquivoDoModelo(arquivos);

    expect(pasta.get('modelo/vgg16-semente1-v1.6.onnx')).toBe(BYTES);
    expect(pasta.has('modelo/vgg16-semente1-v1.6.onnx.copiando')).toBe(false);
  });

  it('apaga o modelo de uma versão anterior', async () => {
    const { arquivos, pasta } = aparelho(COM_MODELO, { 'modelo/vgg16-semente1-v1.4.onnx': 900 });

    await prepararArquivoDoModelo(arquivos);

    expect([...pasta.keys()]).toEqual(['modelo/vgg16-semente1-v1.6.onnx']);
  });

  it('não usa uma cópia que ficou com outro tamanho', async () => {
    const { arquivos, pasta, copiaIncompleta } = aparelho(COM_MODELO);
    copiaIncompleta(700);

    await expect(prepararArquivoDoModelo(arquivos)).rejects.toThrow('cópia do modelo');
    expect(pasta.size).toBe(0);
  });

  it('avisa quando o APK foi gerado sem o modelo', async () => {
    const { arquivos } = aparelho({});

    await expect(prepararArquivoDoModelo(arquivos)).rejects.toBeInstanceOf(ModeloAusenteError);
  });

  it.each([
    ['sem versão', { bytes: BYTES }],
    ['com versão que vira caminho', { versao: '../../banco', bytes: BYTES }],
    ['sem tamanho', { versao: 'v1' }],
    ['com tamanho zero', { versao: 'v1', bytes: 0 }],
  ])('recusa a descrição do modelo %s', async (_caso, descricao) => {
    const { arquivos } = aparelho({
      [DESCRICAO_EMPACOTADA]: JSON.stringify(descricao),
      [MODELO_EMPACOTADO]: BYTES,
    });

    await expect(prepararArquivoDoModelo(arquivos)).rejects.toThrow('descrição do modelo');
  });
});
