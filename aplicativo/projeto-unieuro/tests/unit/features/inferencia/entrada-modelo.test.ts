import {
  areaNoQuadrado,
  LADO_ENTRADA,
  pixelsParaEntrada,
} from '@/features/inferencia/entrada-modelo';

describe('área do desenho no quadrado da entrada', () => {
  it.each([
    [
      'quadro deitado fica centralizado na vertical',
      1200,
      600,
      { x: 0, y: 64, largura: 256, altura: 128 },
    ],
    [
      'quadro em pé fica centralizado na horizontal',
      600,
      1200,
      { x: 64, y: 0, largura: 128, altura: 256 },
    ],
    [
      'quadro quadrado ocupa a entrada inteira',
      512,
      512,
      { x: 0, y: 0, largura: 256, altura: 256 },
    ],
  ])('%s', (_caso, largura, altura, esperado) => {
    expect(areaNoQuadrado(largura, altura)).toEqual(esperado);
  });

  it('mantém a proporção do desenho', () => {
    const area = areaNoQuadrado(1168, 520);

    expect(area.largura / area.altura).toBeCloseTo(1168 / 520);
    expect(area.largura).toBe(LADO_ENTRADA);
  });

  it.each([
    ['largura zero', 0, 100],
    ['altura negativa', 100, -1],
    ['largura infinita', Number.POSITIVE_INFINITY, 100],
    ['altura indefinida', 100, Number.NaN],
  ])('recusa imagem com %s', (_caso, largura, altura) => {
    expect(() => areaNoQuadrado(largura, altura)).toThrow('sem tamanho');
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
