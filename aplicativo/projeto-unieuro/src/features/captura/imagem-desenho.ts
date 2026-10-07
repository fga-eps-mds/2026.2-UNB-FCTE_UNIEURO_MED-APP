/**
 * Imagem final de um desenho, gerada a partir dos traços e não de uma captura
 * da tela: o resultado não depende do que mais estiver na tela nem da
 * resolução do aparelho, e o desenho sai inteiro, sem cortes (história #10).
 *
 * São duas imagens: a do quadro, no tamanho em que o paciente desenhou, para o
 * médico conferir; e a do modelo, reduzida a um quadrado em tons de cinza.
 */
import {
  AlphaType,
  ColorType,
  ImageFormat,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';

import { tracoParaCaminhoSvg, type Traco } from '@/features/captura/eventos-tracado';

/** Lado da entrada da VGG16, usada no modelo base. A confirmar na issue #6 do repositório de IA. */
export const LADO_IMAGEM_MODELO = 224;

/** Espessura do traço no quadro, em pontos de tela. */
export const ESPESSURA_TRACO = 4;

export type Dimensoes = { largura: number; altura: number };

export type Enquadramento = { escala: number; deslocamentoX: number; deslocamentoY: number };

export type ImagemDesenho = {
  /** PNG em base64 do quadro inteiro, no tamanho em que o paciente desenhou. */
  pngQuadro: string;
  /** PNG em base64 do quadro reduzido ao lado do modelo, com faixas brancas. */
  pngModelo: string;
  /** Tons de cinza de 0 (preto) a 1 (branco), linha a linha, com lado × lado valores. */
  cinza: Float32Array;
  lado: number;
};

/**
 * Escala e deslocamento que colocam o quadro inteiro num quadrado, sem cortar
 * e sem distorcer. O que sobra vira faixa branca dos dois lados.
 */
export function calcularEnquadramento({ largura, altura }: Dimensoes, lado: number): Enquadramento {
  if (largura <= 0 || altura <= 0 || lado <= 0) {
    throw new Error('As dimensões do quadro e da imagem precisam ser positivas.');
  }
  const escala = Math.min(lado / largura, lado / altura);
  return {
    escala,
    deslocamentoX: (lado - largura * escala) / 2,
    deslocamentoY: (lado - altura * escala) / 2,
  };
}

/**
 * Converte pixels RGBA de 8 bits em tons de cinza de 0 a 1, com os pesos de
 * luminância da recomendação ITU-R BT.601, os mesmos do `convert('L')` do Pillow.
 */
export function rgbaParaCinza(pixels: Uint8Array): Float32Array {
  if (pixels.length % 4 !== 0) {
    throw new Error('A lista de pixels precisa ter quatro canais por pixel.');
  }
  const cinza = new Float32Array(pixels.length / 4);
  for (let indice = 0; indice < cinza.length; indice += 1) {
    const vermelho = pixels[indice * 4];
    const verde = pixels[indice * 4 + 1];
    const azul = pixels[indice * 4 + 2];
    cinza[indice] = (0.299 * vermelho + 0.587 * verde + 0.114 * azul) / 255;
  }
  return cinza;
}

function desenhar(
  tracos: readonly Traco[],
  saida: Dimensoes,
  { escala, deslocamentoX, deslocamentoY }: Enquadramento,
  espessura: number,
) {
  const superficie = Skia.Surface.MakeOffscreen(
    Math.round(saida.largura),
    Math.round(saida.altura),
  );
  if (!superficie) {
    throw new Error('Não foi possível criar a superfície para gerar a imagem do desenho.');
  }

  const tela = superficie.getCanvas();
  tela.clear(Skia.Color('white'));
  tela.translate(deslocamentoX, deslocamentoY);
  tela.scale(escala, escala);

  const pincel = Skia.Paint();
  pincel.setColor(Skia.Color('black'));
  pincel.setStyle(PaintStyle.Stroke);
  pincel.setStrokeWidth(espessura);
  pincel.setStrokeCap(StrokeCap.Round);
  pincel.setStrokeJoin(StrokeJoin.Round);
  pincel.setAntiAlias(true);

  // O Skia nativo lança erro, em vez de devolver null, quando não consegue ler o
  // caminho. Por isso traço vazio nem chega a ele.
  for (const traco of tracos) {
    if (traco.length === 0) continue;
    const caminho = Skia.Path.MakeFromSVGString(tracoParaCaminhoSvg(traco));
    if (caminho) tela.drawPath(caminho, pincel);
  }

  superficie.flush();
  return superficie.makeImageSnapshot();
}

/** Gera a imagem do quadro e a do modelo a partir dos traços que valem. */
export function gerarImagemDesenho(
  tracos: readonly Traco[],
  quadro: Dimensoes,
  lado = LADO_IMAGEM_MODELO,
  espessura = ESPESSURA_TRACO,
): ImagemDesenho {
  const semAjuste: Enquadramento = { escala: 1, deslocamentoX: 0, deslocamentoY: 0 };
  const imagemQuadro = desenhar(tracos, quadro, semAjuste, espessura);
  const imagemModelo = desenhar(
    tracos,
    { largura: lado, altura: lado },
    calcularEnquadramento(quadro, lado),
    espessura,
  );

  const pixels = imagemModelo.readPixels(0, 0, {
    width: lado,
    height: lado,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!(pixels instanceof Uint8Array)) {
    throw new Error('Não foi possível ler os pixels da imagem do desenho.');
  }

  return {
    pngQuadro: imagemQuadro.encodeToBase64(ImageFormat.PNG),
    pngModelo: imagemModelo.encodeToBase64(ImageFormat.PNG),
    cinza: rgbaParaCinza(pixels),
    lado,
  };
}
