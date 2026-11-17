import type { Traco } from '@/features/captura/eventos-tracado';
import {
  ajustarTracosNaEntrada,
  LADO_ENTRADA,
  pixelsParaEntrada,
} from '@/features/inferencia/entrada-modelo';

const INICIO_DA_CAIXA = 16;
const FIM_DA_CAIXA = 239;
const MEIO_DA_CAIXA = 127.5;

const ponto = (x: number, y: number) => ({ x, y, instante: 0 });
const coordenadas = (tracos: readonly Traco[]) =>
  tracos.map((traco) => traco.map(({ x, y }) => [x, y]));

describe('ajuste dos traços à caixa do treino', () => {
  it('leva a caixa dos pontos para a caixa de 224 px com borda de 16 px', () => {
    const ajustados = ajustarTracosNaEntrada([[ponto(100, 50), ponto(300, 250)]]);

    expect(coordenadas(ajustados)).toEqual([
      [
        [INICIO_DA_CAIXA, INICIO_DA_CAIXA],
        [FIM_DA_CAIXA, FIM_DA_CAIXA],
      ],
    ]);
  });

  it('estica cada eixo separadamente, como no conjunto de treino', () => {
    const ajustados = ajustarTracosNaEntrada([[ponto(0, 0), ponto(200, 50), ponto(400, 100)]]);

    expect(coordenadas(ajustados)[0][1]).toEqual([MEIO_DA_CAIXA, MEIO_DA_CAIXA]);
  });

  it('mesmo desenho em outra posição e outro tamanho do quadro dá os mesmos pontos', () => {
    const desenho = [[ponto(10, 20), ponto(60, 80)], [ponto(30, 40)]];
    const maiorEDeslocado = desenho.map((traco) =>
      traco.map(({ x, y }) => ponto(500 + x * 3, 200 + y * 3)),
    );

    expect(ajustarTracosNaEntrada(maiorEDeslocado)).toEqual(ajustarTracosNaEntrada(desenho));
  });

  it('usa os pontos de todos os traços para a caixa', () => {
    const ajustados = ajustarTracosNaEntrada([[ponto(0, 0)], [ponto(100, 100)]]);

    expect(coordenadas(ajustados)).toEqual([
      [[INICIO_DA_CAIXA, INICIO_DA_CAIXA]],
      [[FIM_DA_CAIXA, FIM_DA_CAIXA]],
    ]);
  });

  it.each([
    [
      'traço horizontal deixa a altura no meio da caixa',
      [ponto(0, 40), ponto(80, 40)],
      [
        [INICIO_DA_CAIXA, MEIO_DA_CAIXA],
        [FIM_DA_CAIXA, MEIO_DA_CAIXA],
      ],
    ],
    [
      'traço vertical deixa a largura no meio da caixa',
      [ponto(40, 0), ponto(40, 80)],
      [
        [MEIO_DA_CAIXA, INICIO_DA_CAIXA],
        [MEIO_DA_CAIXA, FIM_DA_CAIXA],
      ],
    ],
    ['um ponto só fica no centro', [ponto(70, 70)], [[MEIO_DA_CAIXA, MEIO_DA_CAIXA]]],
  ])('%s', (_caso, traco, esperado) => {
    expect(coordenadas(ajustarTracosNaEntrada([traco]))).toEqual([esperado]);
  });

  it('mantém o instante e a pressão de cada ponto sem alterar os traços recebidos', () => {
    const original: Traco[] = [[{ x: 0, y: 0, instante: 12, pressao: 0.4 }, ponto(10, 10)]];
    const copia = structuredClone(original);

    const [[primeiro]] = ajustarTracosNaEntrada(original);

    expect(primeiro).toEqual({
      x: INICIO_DA_CAIXA,
      y: INICIO_DA_CAIXA,
      instante: 12,
      pressao: 0.4,
    });
    expect(original).toEqual(copia);
  });

  it.each([
    ['nenhum traço', []],
    ['só traços sem pontos', [[], []]],
    ['coordenada indefinida', [[ponto(Number.NaN, 0), ponto(10, 10)]]],
    ['coordenada infinita', [[ponto(0, Number.POSITIVE_INFINITY), ponto(10, 10)]]],
  ])('recusa desenho com %s', (_caso, tracos) => {
    expect(() => ajustarTracosNaEntrada(tracos as Traco[])).toThrow('sem traço válido');
  });
});

describe('conversão dos pixels para a entrada do modelo', () => {
  const LADO = 2;

  it('separa os canais, primeiro todo o vermelho, depois o verde e o azul, sem o alfa', () => {
    // prettier-ignore
    const rgba = new Uint8Array([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 0,
    ]);

    // prettier-ignore
    expect(Array.from(pixelsParaEntrada(rgba, LADO))).toEqual([
      1, 0, 0, 1,
      0, 1, 0, 1,
      0, 0, 1, 1,
    ]);
  });

  it('divide cada pixel por 255', () => {
    const rgba = new Uint8Array(LADO * LADO * 4).fill(51);

    const entrada = pixelsParaEntrada(rgba, LADO);

    expect(entrada).toHaveLength(LADO * LADO * 3);
    entrada.forEach((valor) => expect(valor).toBeCloseTo(0.2));
  });

  it('usa o lado da entrada do modelo quando o lado não é informado', () => {
    const rgba = new Uint8Array(LADO_ENTRADA * LADO_ENTRADA * 4);

    expect(pixelsParaEntrada(rgba)).toHaveLength(3 * LADO_ENTRADA * LADO_ENTRADA);
  });

  it('mesmos pixels dão exatamente a mesma entrada', () => {
    const rgba = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 1, 2, 3, 255]);

    expect(pixelsParaEntrada(rgba, LADO)).toEqual(pixelsParaEntrada(rgba.slice(), LADO));
  });

  it.each([
    ['faltam pixels', LADO * LADO * 4 - 1],
    ['sobram pixels', LADO * LADO * 4 + 4],
    ['não há pixels', 0],
  ])('recusa a imagem quando %s', (_caso, tamanho) => {
    expect(() => pixelsParaEntrada(new Uint8Array(tamanho), LADO)).toThrow('fora do tamanho');
  });
});
