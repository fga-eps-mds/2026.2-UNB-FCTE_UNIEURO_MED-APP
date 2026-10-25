import {
  acrescentarAcao,
  acrescentarTraco,
  reconstruirTracos,
  type Traco,
} from '@/features/captura/eventos-tracado';
import { COR_FUNDO, COR_TRACO, ESPESSURA_TRACO } from '@/features/captura/estilo-traco';
import { areaDaImagem, gerarImagemDesenho } from '@/features/captura/imagem-desenho';

const mockFolha = { drawColor: jest.fn(), translate: jest.fn(), drawPath: jest.fn() };
const mockPincel = {
  setAntiAlias: jest.fn(),
  setStyle: jest.fn(),
  setStrokeWidth: jest.fn(),
  setStrokeCap: jest.fn(),
  setStrokeJoin: jest.fn(),
  setColor: jest.fn(),
};
const mockImagem = { encodeToBytes: jest.fn(), dispose: jest.fn() };
const mockSuperficie = {
  getCanvas: () => mockFolha,
  flush: jest.fn(),
  makeImageSnapshot: () => mockImagem,
  dispose: jest.fn(),
};
const mockCriarSuperficie = jest.fn();
const mockLerCaminho = jest.fn();

jest.mock('@shopify/react-native-skia', () => ({
  ImageFormat: { PNG: 'png' },
  PaintStyle: { Stroke: 'stroke' },
  StrokeCap: { Round: 'round' },
  StrokeJoin: { Round: 'round' },
  Skia: {
    Color: (cor: string) => cor,
    Paint: () => mockPincel,
    Path: { MakeFromSVGString: (svg: string) => mockLerCaminho(svg) },
    Surface: { Make: (largura: number, altura: number) => mockCriarSuperficie(largura, altura) },
  },
}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const QUADRO = { largura: 800, altura: 600 };
const MEIA_ESPESSURA = ESPESSURA_TRACO / 2;

const tracoDentro: Traco = [
  { x: 100, y: 100, instante: 0 },
  { x: 200, y: 150, instante: 20 },
];
const tracoApagado: Traco = [
  { x: 300, y: 300, instante: 40 },
  { x: 310, y: 320, instante: 60 },
];

function caminhosDesenhados() {
  return mockFolha.drawPath.mock.calls.map(([caminho]) => caminho.svg);
}

beforeEach(() => {
  mockCriarSuperficie.mockReturnValue(mockSuperficie);
  mockImagem.encodeToBytes.mockReturnValue(PNG);
  mockLerCaminho.mockImplementation((svg: string) => ({ svg }));
});

describe('área da imagem', () => {
  it.each([
    ['sem traço, é o quadro inteiro', [], { x: 0, y: 0, largura: 800, altura: 600 }],
    [
      'com o traço longe da borda, é o quadro inteiro',
      [tracoDentro],
      { x: 0, y: 0, largura: 800, altura: 600 },
    ],
    [
      'cresce até a meia espessura do traço que encosta na borda',
      [[{ x: 0, y: 600, instante: 0 }]],
      { x: -MEIA_ESPESSURA, y: 0, largura: 800 + MEIA_ESPESSURA, altura: 600 + MEIA_ESPESSURA },
    ],
    [
      'cresce até o traço que a caneta levou para fora pela direita e por baixo',
      [[{ x: 850, y: 640, instante: 0 }]],
      { x: 0, y: 0, largura: 850 + MEIA_ESPESSURA, altura: 640 + MEIA_ESPESSURA },
    ],
    [
      'cresce até o traço que a caneta levou para fora pela esquerda e por cima',
      [[{ x: -30, y: -12, instante: 0 }]],
      {
        x: -30 - MEIA_ESPESSURA,
        y: -12 - MEIA_ESPESSURA,
        largura: 830 + MEIA_ESPESSURA,
        altura: 612 + MEIA_ESPESSURA,
      },
    ],
  ])('%s', (_caso, tracos: Traco[], area) => {
    expect(areaDaImagem(tracos, QUADRO)).toEqual(area);
  });

  it('arredonda para pixels inteiros sem cortar o quadro nem o traço', () => {
    const area = areaDaImagem([[{ x: -0.5, y: 10, instante: 0 }]], {
      largura: 799.5,
      altura: 600.2,
    });

    expect(area).toEqual({ x: -3, y: 0, largura: 803, altura: 601 });
  });
});

describe('gerarImagemDesenho', () => {
  it('imagem final guardada: gera o PNG do desenho no tamanho do quadro', () => {
    const png = gerarImagemDesenho([tracoDentro], QUADRO);

    expect(png).toBe(PNG);
    expect(mockCriarSuperficie).toHaveBeenCalledWith(800, 600);
    expect(mockImagem.encodeToBytes).toHaveBeenCalledWith('png');
    expect(mockFolha.drawColor).toHaveBeenCalledWith(COR_FUNDO);
    expect(mockSuperficie.flush).toHaveBeenCalled();
  });

  it('imagem final guardada: desenha os traços com a cor e a espessura do quadro', () => {
    gerarImagemDesenho([tracoDentro], QUADRO);

    expect(mockPincel.setColor).toHaveBeenCalledWith(COR_TRACO);
    expect(mockPincel.setStrokeWidth).toHaveBeenCalledWith(ESPESSURA_TRACO);
    expect(mockPincel.setStyle).toHaveBeenCalledWith('stroke');
    expect(mockPincel.setStrokeCap).toHaveBeenCalledWith('round');
    expect(mockPincel.setStrokeJoin).toHaveBeenCalledWith('round');
    expect(mockFolha.drawPath).toHaveBeenCalledWith({ svg: 'M100 100 L200 150' }, mockPincel);
  });

  it('imagem final guardada: contém só os traços que ficaram na tela', () => {
    const eventos = acrescentarAcao(
      acrescentarTraco(acrescentarTraco([], tracoDentro, 'caneta'), tracoApagado, 'caneta'),
      'desfazer',
      80,
    );

    gerarImagemDesenho(reconstruirTracos(eventos), QUADRO);

    expect(caminhosDesenhados()).toEqual(['M100 100 L200 150']);
  });

  it('imagem final guardada: sem cortes no traço que a caneta levou para fora do quadro', () => {
    const tracoQueSai: Traco = [
      { x: 700, y: 300, instante: 0 },
      { x: 840, y: 300, instante: 30 },
      { x: -20, y: 300, instante: 60 },
    ];

    gerarImagemDesenho([tracoQueSai], QUADRO);

    const area = areaDaImagem([tracoQueSai], QUADRO);
    expect(area).toEqual({ x: -22, y: 0, largura: 864, altura: 600 });
    expect(mockCriarSuperficie).toHaveBeenCalledWith(864, 600);
    expect(mockFolha.translate).toHaveBeenCalledWith(-area.x, -area.y);
    expect(caminhosDesenhados()).toEqual(['M700 300 L840 300 L-20 300']);
  });

  it('ignora traço vazio, que o Skia nativo não aceita', () => {
    gerarImagemDesenho([[], tracoDentro], QUADRO);

    expect(caminhosDesenhados()).toEqual(['M100 100 L200 150']);
  });

  it('gera a imagem em branco quando não há traço', () => {
    expect(gerarImagemDesenho([], QUADRO)).toBe(PNG);
    expect(mockFolha.drawPath).not.toHaveBeenCalled();
  });

  it('libera a memória nativa da superfície e da imagem depois de gerar o PNG', () => {
    gerarImagemDesenho([tracoDentro], QUADRO);

    expect(mockSuperficie.dispose).toHaveBeenCalledTimes(1);
    expect(mockImagem.dispose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['o aparelho não cria a superfície', () => mockCriarSuperficie.mockReturnValue(null)],
    ['um traço não pode ser desenhado', () => mockLerCaminho.mockReturnValueOnce(null)],
    ['o PNG sai vazio', () => mockImagem.encodeToBytes.mockReturnValue(new Uint8Array())],
  ])('tudo ou nada: lança erro quando %s', (_caso, falhar) => {
    falhar();

    expect(() => gerarImagemDesenho([tracoDentro], QUADRO)).toThrow(/imagem do desenho/);
  });

  it.each([
    ['o quadro ainda não foi medido', { largura: 0, altura: 0 }],
    ['o tamanho do quadro não é um número', { largura: Number.NaN, altura: 600 }],
  ])('tudo ou nada: lança erro sem criar a superfície quando %s', (_caso, dimensoes) => {
    expect(() => gerarImagemDesenho([], dimensoes)).toThrow(/imagem do desenho/);
    expect(mockCriarSuperficie).not.toHaveBeenCalled();
  });

  it.each([
    ['um traço não pode ser desenhado', () => mockLerCaminho.mockReturnValueOnce(null)],
    ['o PNG sai vazio', () => mockImagem.encodeToBytes.mockReturnValue(new Uint8Array())],
  ])('libera a memória nativa mesmo quando %s', (_caso, falhar) => {
    falhar();

    expect(() => gerarImagemDesenho([tracoDentro], QUADRO)).toThrow();
    expect(mockSuperficie.dispose).toHaveBeenCalledTimes(1);
  });
});
