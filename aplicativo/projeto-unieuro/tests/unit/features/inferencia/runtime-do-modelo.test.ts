import { InferenceSession, Tensor } from 'onnxruntime-react-native';

import { arquivosDoAparelho, runtimeOnnx } from '@/features/inferencia/runtime-do-modelo';

jest.mock('@/features/inferencia/preparo-desenho', () => ({ prepararDesenho: jest.fn() }));

// O sistema de arquivos do Expo em memória: o APK (`asset://`) e a pasta do aplicativo.
const mockArquivos = new Map<string, { texto?: string; tamanho: number }>();
const mockDiretorios = new Set<string>();

jest.mock('expo-file-system', () => {
  const juntar = (...partes: (string | { uri: string })[]) =>
    partes.map((parte) => (typeof parte === 'string' ? parte : parte.uri)).join('/');
  class File {
    uri: string;
    constructor(...partes: (string | { uri: string })[]) {
      this.uri = juntar(...partes);
    }
    get exists() {
      return mockArquivos.has(this.uri);
    }
    get size() {
      return mockArquivos.get(this.uri)!.tamanho;
    }
    get parentDirectory() {
      const uri = this.uri.slice(0, this.uri.lastIndexOf('/'));
      return { create: () => mockDiretorios.add(uri) };
    }
    async text() {
      return mockArquivos.get(this.uri)!.texto!;
    }
    async copy(destino: File) {
      mockArquivos.set(destino.uri, mockArquivos.get(this.uri)!);
    }
    async move(destino: File) {
      mockArquivos.set(destino.uri, mockArquivos.get(this.uri)!);
      mockArquivos.delete(this.uri);
    }
    delete() {
      mockArquivos.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(...partes: (string | { uri: string })[]) {
      this.uri = juntar(...partes);
    }
    get exists() {
      return [...mockArquivos.keys()].some((uri) => uri.startsWith(`${this.uri}/`));
    }
    list() {
      return [...mockArquivos.keys()]
        .filter((uri) => uri.startsWith(`${this.uri}/`))
        .map((uri) => ({ name: uri.slice(this.uri.length + 1) }));
    }
  }
  return {
    File,
    Directory,
    Paths: { bundle: { uri: 'asset://' }, document: { uri: 'file:///dados' } },
  };
});

jest.mock('onnxruntime-react-native', () => ({
  InferenceSession: { create: jest.fn() },
  Tensor: jest.fn(function Tensor(this: object, tipo: string, dados: unknown, forma: unknown) {
    Object.assign(this, { tipo, dados, forma });
  }),
}));

beforeEach(() => {
  mockArquivos.clear();
  mockDiretorios.clear();
});

describe('arquivos do aparelho', () => {
  it('lê o que está empacotado no APK e avisa o que não está', async () => {
    mockArquivos.set('asset:///modelo/modelo.json', { texto: '{"versao":"v1"}', tamanho: 15 });

    await expect(arquivosDoAparelho.lerEmpacotado('modelo/modelo.json')).resolves.toBe(
      '{"versao":"v1"}',
    );
    await expect(arquivosDoAparelho.lerEmpacotado('modelo/outro.json')).resolves.toBeNull();
  });

  it('copia do APK para a pasta do aplicativo, cria a pasta e move o arquivo', async () => {
    mockArquivos.set('asset:///modelo/modelo.onnx', { tamanho: 900 });

    await arquivosDoAparelho.copiarEmpacotado('modelo/modelo.onnx', 'modelo/v1.onnx.copiando');
    await arquivosDoAparelho.moverLocal('modelo/v1.onnx.copiando', 'modelo/v1.onnx');

    expect(mockDiretorios.has('file:///dados/modelo')).toBe(true);
    expect(arquivosDoAparelho.tamanhoLocal('modelo/v1.onnx')).toBe(900);
    expect(arquivosDoAparelho.tamanhoLocal('modelo/v1.onnx.copiando')).toBeNull();
    expect(arquivosDoAparelho.listarLocais('modelo')).toEqual(['v1.onnx']);
    expect(arquivosDoAparelho.enderecoLocal('modelo/v1.onnx')).toBe('file:///dados/modelo/v1.onnx');
  });

  it('apaga só o que existe e lista uma pasta vazia sem erro', () => {
    arquivosDoAparelho.apagarLocal('modelo/nada.onnx');

    expect(arquivosDoAparelho.listarLocais('modelo')).toEqual([]);
  });
});

describe('ONNX Runtime', () => {
  it('cria o tensor em float32 com a forma pedida', () => {
    const dados = new Float32Array(3);

    runtimeOnnx.criarTensor(dados, [1, 3]);

    expect(Tensor).toHaveBeenCalledWith('float32', dados, [1, 3]);
  });

  it('abre a sessão só na CPU e entrega as saídas float32', async () => {
    const run = jest.fn(async () => ({
      probabilidade_ccl: { type: 'float32', data: new Float32Array([0.4]), dims: [1] },
      outra: { type: 'int64', data: [1], dims: [1] },
    }));
    jest.mocked(InferenceSession.create).mockResolvedValue({ run } as never);

    const sessao = await runtimeOnnx.abrirSessao('file:///dados/modelo/v1.onnx');
    const saidas = await sessao.run({ relogio: {} });

    expect(InferenceSession.create).toHaveBeenCalledWith('file:///dados/modelo/v1.onnx', {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
    expect(saidas.probabilidade_ccl).toEqual({ data: new Float32Array([0.4]), dims: [1] });
    expect(saidas.outra).toBeUndefined();
  });
});
