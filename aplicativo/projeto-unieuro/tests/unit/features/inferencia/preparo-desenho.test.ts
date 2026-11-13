import { COR_FUNDO } from '@/features/captura/estilo-traco';
import { LADO_ENTRADA } from '@/features/inferencia/entrada-modelo';
import { prepararDesenho } from '@/features/inferencia/preparo-desenho';

const mockFolha = { drawColor: jest.fn(), drawImageRectOptions: jest.fn() };
const mockReduzida = { readPixels: jest.fn(), dispose: jest.fn() };
const mockSuperficie = {
  getCanvas: () => mockFolha,
  flush: jest.fn(),
  makeImageSnapshot: () => mockReduzida,
  dispose: jest.fn(),
};
const mockOriginal = { width: () => 1200, height: () => 600, dispose: jest.fn() };
const mockLerPng = jest.fn();
const mockCriarSuperficie = jest.fn();

jest.mock('@shopify/react-native-skia', () => ({
  AlphaType: { Unpremul: 'unpremul' },
  ColorType: { RGBA_8888: 'rgba8888' },
  FilterMode: { Linear: 'filtro-linear' },
  MipmapMode: { Linear: 'mipmap-linear' },
  Skia: {
    Color: (cor: string) => cor,
    Data: { fromBytes: (bytes: Uint8Array) => ({ bytes }) },
    Image: { MakeImageFromEncoded: (dados: unknown) => mockLerPng(dados) },
    Surface: { Make: (largura: number, altura: number) => mockCriarSuperficie(largura, altura) },
    XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
  },
}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const PIXELS_BRANCOS = new Uint8Array(LADO_ENTRADA * LADO_ENTRADA * 4).fill(255);

beforeEach(() => {
  mockLerPng.mockReturnValue(mockOriginal);
  mockCriarSuperficie.mockReturnValue(mockSuperficie);
  mockReduzida.readPixels.mockReturnValue(PIXELS_BRANCOS);
});

function liberouTudo() {
  expect(mockOriginal.dispose).toHaveBeenCalledTimes(1);
  expect(mockSuperficie.dispose).toHaveBeenCalledTimes(1);
  expect(mockReduzida.dispose).toHaveBeenCalledTimes(1);
}

describe('preparo do desenho para o modelo', () => {
  it('lê o PNG gravado na captura', () => {
    prepararDesenho(PNG);

    expect(mockLerPng).toHaveBeenCalledWith({ bytes: PNG });
  });

  it('reduz o desenho inteiro para o quadrado da entrada, sem esticar, sobre o fundo do papel', () => {
    prepararDesenho(PNG);

    expect(mockCriarSuperficie).toHaveBeenCalledWith(LADO_ENTRADA, LADO_ENTRADA);
    expect(mockFolha.drawColor).toHaveBeenCalledWith(COR_FUNDO);
    expect(mockFolha.drawImageRectOptions).toHaveBeenCalledWith(
      mockOriginal,
      { x: 0, y: 0, width: 1200, height: 600 },
      { x: 0, y: 64, width: 256, height: 128 },
      'filtro-linear',
      'mipmap-linear',
    );
  });

  it('lê os pixels em RGBA sem pré-multiplicar o alfa', () => {
    prepararDesenho(PNG);

    expect(mockReduzida.readPixels).toHaveBeenCalledWith(0, 0, {
      width: LADO_ENTRADA,
      height: LADO_ENTRADA,
      colorType: 'rgba8888',
      alphaType: 'unpremul',
    });
  });

  it('devolve a entrada no formato do modelo e libera a memória nativa', () => {
    const entrada = prepararDesenho(PNG);

    expect(entrada).toHaveLength(3 * LADO_ENTRADA * LADO_ENTRADA);
    expect(entrada.every((valor) => valor === 1)).toBe(true);
    liberouTudo();
  });

  it('recusa um PNG que o Skia não consegue ler', () => {
    mockLerPng.mockReturnValue(null);

    expect(() => prepararDesenho(PNG)).toThrow('ler a imagem do desenho');
    expect(mockCriarSuperficie).not.toHaveBeenCalled();
  });

  it('falha e libera a imagem original quando a superfície não é criada', () => {
    mockCriarSuperficie.mockReturnValue(null);

    expect(() => prepararDesenho(PNG)).toThrow('imagem reduzida');
    expect(mockOriginal.dispose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['não há pixels', null],
    ['os pixels vêm em ponto flutuante', new Float32Array(4)],
  ])('falha e libera tudo quando %s', (_caso, pixels) => {
    mockReduzida.readPixels.mockReturnValue(pixels);

    expect(() => prepararDesenho(PNG)).toThrow('ler os pixels');
    liberouTudo();
  });
});
