import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';

import { COR_FUNDO } from '@/features/captura/estilo-traco';
import {
  areaNoQuadrado,
  LADO_ENTRADA,
  pixelsParaEntrada,
} from '@/features/inferencia/entrada-modelo';

// O treino reduz as imagens com interpolação bilinear (IA, exportacao/imagens.py). Os mipmaps
// evitam o serrilhado ao reduzir o PNG do quadro, bem maior que a entrada do modelo.
const AMOSTRAGEM = { filtro: FilterMode.Linear, mipmap: MipmapMode.Linear };

const PIXELS_DA_ENTRADA = {
  width: LADO_ENTRADA,
  height: LADO_ENTRADA,
  colorType: ColorType.RGBA_8888,
  alphaType: AlphaType.Unpremul,
};

function lerPixels(reduzida: SkImage): Uint8Array {
  try {
    const pixels = reduzida.readPixels(0, 0, PIXELS_DA_ENTRADA);
    if (!(pixels instanceof Uint8Array)) {
      throw new Error('Não foi possível ler os pixels do desenho reduzido.');
    }
    return pixels;
  } finally {
    reduzida.dispose();
  }
}

function reduzirParaEntrada(imagem: SkImage): Uint8Array {
  const superficie = Skia.Surface.Make(LADO_ENTRADA, LADO_ENTRADA);
  if (!superficie) throw new Error('Não foi possível criar a imagem reduzida do desenho.');

  // Superfície e imagens ocupam memória nativa, que o coletor do JavaScript não libera.
  try {
    const area = areaNoQuadrado(imagem.width(), imagem.height());
    const folha = superficie.getCanvas();
    folha.drawColor(Skia.Color(COR_FUNDO));
    folha.drawImageRectOptions(
      imagem,
      Skia.XYWHRect(0, 0, imagem.width(), imagem.height()),
      Skia.XYWHRect(area.x, area.y, area.largura, area.altura),
      AMOSTRAGEM.filtro,
      AMOSTRAGEM.mipmap,
    );
    superficie.flush();
    return lerPixels(superficie.makeImageSnapshot());
  } finally {
    superficie.dispose();
  }
}

export function prepararDesenho(png: Uint8Array): Float32Array {
  const imagem = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(png));
  if (!imagem) throw new Error('Não foi possível ler a imagem do desenho.');
  try {
    return pixelsParaEntrada(reduzirParaEntrada(imagem));
  } finally {
    imagem.dispose();
  }
}
