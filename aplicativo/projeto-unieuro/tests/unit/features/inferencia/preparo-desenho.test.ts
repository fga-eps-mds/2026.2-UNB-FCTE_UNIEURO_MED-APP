import type { Traco } from '@/features/captura/eventos-tracado';
import { LADO_ENTRADA } from '@/features/inferencia/entrada-modelo';
import { prepararDesenho } from '@/features/inferencia/preparo-desenho';

const mockPincel = {
  setAntiAlias: jest.fn(),
  setStyle: jest.fn(),
  setStrokeWidth: jest.fn(),
  setStrokeCap: jest.fn(),
  setStrokeJoin: jest.fn(),
  setColor: jest.fn(),
};
const mockFolha = { drawColor: jest.fn(), drawPath: jest.fn() };
const mockDesenho = { readPixels: jest.fn(), dispose: jest.fn() };
const mockSuperficie = {
  getCanvas: () => mockFolha,
  flush: jest.fn(),
  makeImageSnapshot: () => mockDesenho,
  dispose: jest.fn(),
};
const mockCriarSuperficie = jest.fn();
const mockMontarCaminho = jest.fn();

jest.mock('@shopify/react-native-skia', () => ({
  AlphaType: { Unpremul: 'unpremul' },
  ColorType: { RGBA_8888: 'rgba8888' },
  PaintStyle: { Stroke: 'contorno' },
  StrokeCap: { Round: 'ponta-redonda' },
  StrokeJoin: { Round: 'juncao-redonda' },
  Skia: {
    Color: (cor: string) => cor,
    Paint: () => mockPincel,
    Path: { MakeFromSVGString: (svg: string) => mockMontarCaminho(svg) },
    Surface: { Make: (largura: number, altura: number) => mockCriarSuperficie(largura, altura) },
  },
}));

const ponto = (x: number, y: number) => ({ x, y, instante: 0 });
const DESENHO: Traco[] = [[ponto(100, 50), ponto(300, 250)], [ponto(200, 150)]];
const PIXELS_BRANCOS = new Uint8Array(LADO_ENTRADA * LADO_ENTRADA * 4).fill(255);

beforeEach(() => {
  mockCriarSuperficie.mockReturnValue(mockSuperficie);
  mockMontarCaminho.mockImplementation((svg: string) => ({ svg }));
  mockDesenho.readPixels.mockReturnValue(PIXELS_BRANCOS);
});

function liberouTudo() {
  expect(mockSuperficie.dispose).toHaveBeenCalledTimes(1);
  expect(mockDesenho.dispose).toHaveBeenCalledTimes(1);
}

describe('preparo do desenho para o modelo', () => {
  it('desenha numa imagem do tamanho da entrada, com fundo branco', () => {
    prepararDesenho(DESENHO);

    expect(mockCriarSuperficie).toHaveBeenCalledWith(LADO_ENTRADA, LADO_ENTRADA);
    expect(mockFolha.drawColor).toHaveBeenCalledWith('#FFFFFF');
  });

  it('redesenha os pontos dos traços já ajustados à caixa do treino', () => {
    prepararDesenho(DESENHO);

    expect(mockMontarCaminho.mock.calls).toEqual([
      ['M16 16 L239 239'],
      ['M127.5 127.5 L127.5 127.5'],
    ]);
    expect(mockFolha.drawPath).toHaveBeenCalledTimes(2);
    expect(mockFolha.drawPath).toHaveBeenCalledWith({ svg: 'M16 16 L239 239' }, mockPincel);
  });

  it('usa traço preto de 2,5 px, com pontas arredondadas e antialias, como no conjunto de treino', () => {
    prepararDesenho(DESENHO);

    expect(mockPincel.setColor).toHaveBeenCalledWith('#000000');
    expect(mockPincel.setStrokeWidth).toHaveBeenCalledWith(2.5);
    expect(mockPincel.setStyle).toHaveBeenCalledWith('contorno');
    expect(mockPincel.setStrokeCap).toHaveBeenCalledWith('ponta-redonda');
    expect(mockPincel.setStrokeJoin).toHaveBeenCalledWith('juncao-redonda');
    expect(mockPincel.setAntiAlias).toHaveBeenCalledWith(true);
  });

  it('pula o traço sem pontos', () => {
    prepararDesenho([...DESENHO, []]);

    expect(mockFolha.drawPath).toHaveBeenCalledTimes(2);
  });

  it('lê os pixels em RGBA sem pré-multiplicar o alfa', () => {
    prepararDesenho(DESENHO);

    expect(mockDesenho.readPixels).toHaveBeenCalledWith(0, 0, {
      width: LADO_ENTRADA,
      height: LADO_ENTRADA,
      colorType: 'rgba8888',
      alphaType: 'unpremul',
    });
  });

  it('devolve a entrada no formato do modelo e libera a memória nativa', () => {
    const entrada = prepararDesenho(DESENHO);

    expect(entrada).toHaveLength(3 * LADO_ENTRADA * LADO_ENTRADA);
    expect(entrada.every((valor) => valor === 1)).toBe(true);
    liberouTudo();
  });

  it('recusa o desenho sem traço antes de criar a imagem', () => {
    expect(() => prepararDesenho([])).toThrow('sem traço válido');
    expect(mockCriarSuperficie).not.toHaveBeenCalled();
  });

  it('falha quando a imagem de entrada não é criada', () => {
    mockCriarSuperficie.mockReturnValue(null);

    expect(() => prepararDesenho(DESENHO)).toThrow('imagem de entrada');
  });

  it('falha e libera a imagem quando um traço não vira caminho', () => {
    mockMontarCaminho.mockReturnValue(null);

    expect(() => prepararDesenho(DESENHO)).toThrow('desenhar um traço');
    expect(mockSuperficie.dispose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['não há pixels', null],
    ['os pixels vêm em ponto flutuante', new Float32Array(4)],
  ])('falha e libera tudo quando %s', (_caso, pixels) => {
    mockDesenho.readPixels.mockReturnValue(pixels);

    expect(() => prepararDesenho(DESENHO)).toThrow('ler os pixels');
    liberouTudo();
  });
});
