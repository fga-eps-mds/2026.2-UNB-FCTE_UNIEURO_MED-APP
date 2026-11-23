import { LADO_DO_MAPA, type EntradasDoModelo } from '@/features/inferencia/escore';
import {
  criarCarregadorDoModelo,
  FORMA_DA_ENTRADA,
  type RuntimeOnnx,
  type SessaoDoModelo,
  type TensorDeSaida,
} from '@/features/inferencia/modelo-onnx';

// O preparo pelo Skia não entra aqui: o modelo recebe as entradas já prontas.
jest.mock('@/features/inferencia/preparo-desenho', () => ({ prepararDesenho: jest.fn() }));

const CELULAS = LADO_DO_MAPA * LADO_DO_MAPA;
const ENTRADAS: EntradasDoModelo = {
  relogio: new Float32Array([0.1]),
  cubo: new Float32Array([0.2]),
  trilhas: new Float32Array([0.3]),
};

// Os mapas vêm num tensor só, de 1 × 3 × 8 × 8: as 64 células do relógio, depois as do cubo e
// as das trilhas.
const mapas = Float32Array.from({ length: 3 * CELULAS }, (_, indice) => indice / (3 * CELULAS));

function saidasDoArquivo(extra: Record<string, TensorDeSaida | undefined> = {}) {
  return {
    probabilidade_ccl: { data: new Float32Array([0.62]), dims: [1] },
    contribuicoes: { data: new Float32Array([0.5, -0.25, 1]), dims: [1, 3] },
    mapas: { data: mapas, dims: [1, 3, LADO_DO_MAPA, LADO_DO_MAPA] },
    ...extra,
  };
}

function runtimeCom(saidas: Record<string, TensorDeSaida | undefined> = saidasDoArquivo()) {
  const sessao: SessaoDoModelo = { run: jest.fn(async () => saidas) };
  const runtime: RuntimeOnnx = {
    criarTensor: jest.fn((dados, forma) => ({ dados, forma })),
    abrirSessao: jest.fn(async () => sessao),
  };
  return { runtime, sessao };
}

const localizar = jest.fn(async () => ({ endereco: 'file:///modelo.onnx', versao: 'v1.6' }));

beforeEach(() => {
  localizar.mockClear();
});

describe('modelo pelo ONNX Runtime', () => {
  it('entrega cada desenho com o nome da tarefa e a forma 1 × 3 × 256 × 256', async () => {
    const { runtime, sessao } = runtimeCom();
    const { modelo } = await criarCarregadorDoModelo(localizar, runtime)();

    await modelo.avaliar(ENTRADAS);

    expect(runtime.criarTensor).toHaveBeenCalledWith(ENTRADAS.relogio, FORMA_DA_ENTRADA);
    expect(FORMA_DA_ENTRADA).toEqual([1, 3, 256, 256]);
    expect(sessao.run).toHaveBeenCalledWith({
      relogio: { dados: ENTRADAS.relogio, forma: FORMA_DA_ENTRADA },
      cubo: { dados: ENTRADAS.cubo, forma: FORMA_DA_ENTRADA },
      trilhas: { dados: ENTRADAS.trilhas, forma: FORMA_DA_ENTRADA },
    });
  });

  it('lê a probabilidade, a contribuição e o mapa de cada desenho', async () => {
    const { runtime } = runtimeCom();
    const { modelo, versao } = await criarCarregadorDoModelo(localizar, runtime)();

    const saidas = await modelo.avaliar(ENTRADAS);

    expect(versao).toBe('v1.6');
    expect(saidas.probabilidade).toBeCloseTo(0.62);
    expect(saidas.contribuicoes).toEqual({ relogio: 0.5, cubo: -0.25, trilhas: 1 });
    expect(Array.from(saidas.mapas.cubo)).toEqual(Array.from(mapas.slice(CELULAS, 2 * CELULAS)));
    expect(saidas.mapas.trilhas).toHaveLength(CELULAS);
  });

  it.each([
    ['sem a probabilidade', { probabilidade_ccl: undefined }],
    ['com as contribuições em outra forma', { contribuicoes: { data: [1, 2], dims: [1, 2] } }],
    ['com os mapas em outra forma', { mapas: { data: mapas, dims: [1, 3, 16, 4] } }],
  ])('recusa o arquivo %s', async (_caso, extra) => {
    const { runtime } = runtimeCom(saidasDoArquivo(extra));
    const { modelo } = await criarCarregadorDoModelo(localizar, runtime)();

    await expect(modelo.avaliar(ENTRADAS)).rejects.toThrow('formato esperado');
  });

  it('abre a sessão uma vez para vários exames', async () => {
    const { runtime } = runtimeCom();
    const carregar = criarCarregadorDoModelo(localizar, runtime);

    await carregar();
    await carregar();

    expect(runtime.abrirSessao).toHaveBeenCalledTimes(1);
    expect(runtime.abrirSessao).toHaveBeenCalledWith('file:///modelo.onnx');
  });

  it('tenta abrir de novo depois de uma falha', async () => {
    const { runtime } = runtimeCom();
    jest.mocked(runtime.abrirSessao).mockRejectedValueOnce(new Error('sem memória'));
    const carregar = criarCarregadorDoModelo(localizar, runtime);

    await expect(carregar()).rejects.toThrow('sem memória');
    await expect(carregar()).resolves.toMatchObject({ versao: 'v1.6' });
    expect(runtime.abrirSessao).toHaveBeenCalledTimes(2);
  });
});
