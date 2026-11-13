// Contrato do modelo exportado (repositório de IA, docs/exportacao-do-modelo.md, Tabela 4):
// cada desenho entra em RGB de 256 × 256, com os canais separados (todo o vermelho, depois o
// verde e o azul) e cada pixel dividido por 255. A normalização fica dentro do modelo.
export const LADO_ENTRADA = 256;

const CANAIS_RGBA = 4;
const CANAIS_RGB = 3;
const VALOR_MAXIMO_PIXEL = 255;

export type Retangulo = { x: number; y: number; largura: number; altura: number };

export function areaNoQuadrado(
  largura: number,
  altura: number,
  lado: number = LADO_ENTRADA,
): Retangulo {
  const temTamanho = Number.isFinite(largura) && Number.isFinite(altura);
  if (!temTamanho || largura <= 0 || altura <= 0) {
    throw new Error('Imagem do desenho sem tamanho para o preparo do escore.');
  }
  // Esticar o quadro até o quadrado deforma o desenho, e o recorte central perde o traço que
  // ficar fora dele (IA, Tabela 8). O desenho inteiro é reduzido na mesma escala nos dois
  // eixos e centralizado, e o resto do quadrado fica com o fundo do papel.
  const escala = lado / Math.max(largura, altura);
  const larguraReduzida = largura * escala;
  const alturaReduzida = altura * escala;
  return {
    x: (lado - larguraReduzida) / 2,
    y: (lado - alturaReduzida) / 2,
    largura: larguraReduzida,
    altura: alturaReduzida,
  };
}

export function pixelsParaEntrada(rgba: Uint8Array, lado: number = LADO_ENTRADA): Float32Array {
  const totalDePixels = lado * lado;
  if (rgba.length !== totalDePixels * CANAIS_RGBA) {
    throw new Error('Pixels do desenho fora do tamanho esperado pelo modelo.');
  }
  // O canal alfa fica de fora: o fundo do desenho é opaco.
  const entrada = new Float32Array(totalDePixels * CANAIS_RGB);
  for (let pixel = 0; pixel < totalDePixels; pixel++) {
    for (let canal = 0; canal < CANAIS_RGB; canal++) {
      entrada[canal * totalDePixels + pixel] =
        rgba[pixel * CANAIS_RGBA + canal] / VALOR_MAXIMO_PIXEL;
    }
  }
  return entrada;
}
