import type { Traco } from '@/features/captura/eventos-tracado';
import { LADO_ENTRADA } from '@/features/inferencia/entrada-modelo';
import { prepararDesenho } from '@/features/inferencia/preparo-desenho';

// O jest.setup troca o Skia por um substituto sem pixels. Aqui o preparo usa o Skia de verdade,
// o CanvasKit que a própria biblioteca usa fora do aparelho. Ele carrega de forma assíncrona,
// então o módulo nasce com um Skia vazio, preenchido antes dos testes.
jest.mock('@shopify/react-native-skia', () => ({
  ...jest.requireActual('@shopify/react-native-skia/lib/commonjs/skia/types'),
  Skia: {},
}));

type SkiaWeb = {
  LoadSkiaWeb: () => Promise<void>;
};
type FabricaDoSkia = {
  JsiSkApi: (canvasKit: unknown) => object;
};
type UtilDoNode = {
  TextDecoder: typeof TextDecoder;
};

const TEMPO_PARA_CARREGAR_O_SKIA = 60000;
const LIMIAR_DA_TINTA = 0.5;
const CANAIS = 3;
// O conjunto de treino tem a tinta de 13 a 242 px e traço de 2,3 a 2,5 px (IA #21, PR #29).
const ESPESSURA_DO_TREINO = 2.5;
const TINTA_COMECA_ENTRE = [14, 16];
const TINTA_TERMINA_ENTRE = [238, 241];
const BORDA_DE_CIMA_DA_CAIXA = 16;
const MEIA_JANELA = 8;
const BORDA_SUAVIZADA = [0.05, 0.95];

async function carregarSkiaReal() {
  const { LoadSkiaWeb } = jest.requireActual<SkiaWeb>(
    '@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb',
  );
  const { JsiSkApi } = jest.requireActual<FabricaDoSkia>(
    '@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia',
  );
  // O Expo troca o TextDecoder global por um que só lê UTF-8, e o CanvasKit pede UTF-16 ao carregar.
  const decodificadorDoExpo = globalThis.TextDecoder;
  globalThis.TextDecoder = jest.requireActual<UtilDoNode>('util').TextDecoder;
  try {
    await LoadSkiaWeb();
  } finally {
    globalThis.TextDecoder = decodificadorDoExpo;
  }
  return JsiSkApi((globalThis as { CanvasKit?: unknown }).CanvasKit);
}

beforeAll(async () => {
  const { Skia } = jest.requireMock<{ Skia: object }>('@shopify/react-native-skia');
  Object.assign(Skia, await carregarSkiaReal());
}, TEMPO_PARA_CARREGAR_O_SKIA);

const ponto = (x: number, y: number) => ({ x, y, instante: 0 });
const QUADRADO: Traco[] = [
  [ponto(100, 100), ponto(300, 100), ponto(300, 300), ponto(100, 300), ponto(100, 100)],
];
const MEIO = LADO_ENTRADA / 2;

function canal(entrada: Float32Array, indice: number, x: number, y: number) {
  return entrada[indice * LADO_ENTRADA * LADO_ENTRADA + y * LADO_ENTRADA + x];
}

function cinza(entrada: Float32Array, x: number, y: number) {
  let soma = 0;
  for (let indice = 0; indice < CANAIS; indice++) soma += canal(entrada, indice, x, y);
  return soma / CANAIS;
}

function caixaDaTinta(entrada: Float32Array) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < LADO_ENTRADA; y++) {
    for (let x = 0; x < LADO_ENTRADA; x++) {
      if (cinza(entrada, x, y) < LIMIAR_DA_TINTA) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  return {
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
    yMin: Math.min(...ys),
    yMax: Math.max(...ys),
  };
}

function colunaNaBordaDeCima(entrada: Float32Array) {
  const primeiraLinha = BORDA_DE_CIMA_DA_CAIXA - MEIA_JANELA;
  return Array.from({ length: 2 * MEIA_JANELA }, (_, linha) =>
    cinza(entrada, MEIO, primeiraLinha + linha),
  );
}

describe('preparo do desenho com o Skia real', () => {
  it('desenha o traço preto sobre fundo branco, com os três canais iguais', () => {
    const entrada = prepararDesenho(QUADRADO);

    expect(cinza(entrada, MEIO, MEIO)).toBe(1);
    expect(cinza(entrada, 0, 0)).toBe(1);
    const naBorda = [0, 1, 2].map((indice) => canal(entrada, indice, MEIO, BORDA_DE_CIMA_DA_CAIXA));
    expect(naBorda[0]).toBeLessThan(LIMIAR_DA_TINTA);
    expect(new Set(naBorda).size).toBe(1);
  });

  it('leva o desenho para a caixa do treino, com a tinta entre 14 e 241 px', () => {
    const caixa = caixaDaTinta(prepararDesenho(QUADRADO));

    for (const inicio of [caixa.xMin, caixa.yMin]) {
      expect(inicio).toBeGreaterThanOrEqual(TINTA_COMECA_ENTRE[0]);
      expect(inicio).toBeLessThanOrEqual(TINTA_COMECA_ENTRE[1]);
    }
    for (const fim of [caixa.xMax, caixa.yMax]) {
      expect(fim).toBeGreaterThanOrEqual(TINTA_TERMINA_ENTRE[0]);
      expect(fim).toBeLessThanOrEqual(TINTA_TERMINA_ENTRE[1]);
    }
  });

  it('desenha o traço com a espessura do conjunto de treino e a borda suavizada', () => {
    const coluna = colunaNaBordaDeCima(prepararDesenho(QUADRADO));

    const tinta = coluna.reduce((soma, valor) => soma + (1 - valor), 0);
    expect(tinta).toBeCloseTo(ESPESSURA_DO_TREINO, 0);
    const [quaseTinta, quaseFundo] = BORDA_SUAVIZADA;
    expect(coluna.some((valor) => valor > quaseTinta && valor < quaseFundo)).toBe(true);
  });

  it('mesmo desenho em outra posição e outro tamanho do quadro dá a mesma entrada', () => {
    const maiorEDeslocado = QUADRADO.map((traco) =>
      traco.map(({ x, y }) => ponto(40 + x * 3, 25 + y * 3)),
    );

    const original = prepararDesenho(QUADRADO);
    const outro = prepararDesenho(maiorEDeslocado);

    expect(outro).toHaveLength(original.length);
    expect(outro.filter((valor, indice) => valor !== original[indice])).toHaveLength(0);
  });

  it('um ponto só vira uma marca no centro da entrada', () => {
    const entrada = prepararDesenho([[ponto(70, 70)]]);

    expect(Math.min(cinza(entrada, MEIO - 1, MEIO - 1), cinza(entrada, MEIO, MEIO))).toBeLessThan(
      LIMIAR_DA_TINTA,
    );
    expect(cinza(entrada, 0, 0)).toBe(1);
  });
});
