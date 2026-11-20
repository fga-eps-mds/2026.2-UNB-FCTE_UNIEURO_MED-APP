import {
  AlphaType,
  ColorType,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkImage,
  type SkPaint,
} from '@shopify/react-native-skia';

import { tracoParaCaminhoSvg, type Traco } from '@/features/captura/eventos-tracado';
import {
  ajustarTracosNaEntrada,
  LADO_ENTRADA,
  pixelsParaEntrada,
} from '@/features/inferencia/entrada-modelo';

// O conjunto de treino tem traço preto de 2,3 a 2,5 px com antialias, sobre fundo branco
// (IA #21, PR #29). O traço de 4 pt da tela deixaria o desenho mais grosso que o do treino.
const ESPESSURA_NA_ENTRADA = 2.5;
const COR_DO_TRACO_NA_ENTRADA = '#000000';
const COR_DO_FUNDO_NA_ENTRADA = '#FFFFFF';

// Sem o formato explícito, a leitura devolve o da superfície, que no Android pode vir em BGRA
// ou com o alfa pré-multiplicado. O modelo espera os canais na ordem RGB do treino.
const PIXELS_DA_ENTRADA = {
  width: LADO_ENTRADA,
  height: LADO_ENTRADA,
  colorType: ColorType.RGBA_8888,
  alphaType: AlphaType.Unpremul,
};

function criarPincel() {
  const pincel = Skia.Paint();
  pincel.setAntiAlias(true);
  pincel.setStyle(PaintStyle.Stroke);
  pincel.setStrokeWidth(ESPESSURA_NA_ENTRADA);
  pincel.setStrokeCap(StrokeCap.Round);
  pincel.setStrokeJoin(StrokeJoin.Round);
  pincel.setColor(Skia.Color(COR_DO_TRACO_NA_ENTRADA));
  return pincel;
}

function desenharTraco(folha: SkCanvas, traco: Traco, pincel: SkPaint) {
  const caminho = Skia.Path.MakeFromSVGString(tracoParaCaminhoSvg(traco));
  // Um traço que falta mudaria o escore sem aviso.
  if (!caminho) throw new Error('Não foi possível desenhar um traço na entrada do modelo.');
  try {
    folha.drawPath(caminho, pincel);
  } finally {
    caminho.dispose();
  }
}

// Pincel e caminhos também ocupam memória nativa, e um exame cria um caminho por traço.
function desenharTracos(folha: SkCanvas, tracos: readonly Traco[]) {
  const pincel = criarPincel();
  try {
    for (const traco of tracos.filter((pontos) => pontos.length > 0)) {
      desenharTraco(folha, traco, pincel);
    }
  } finally {
    pincel.dispose();
  }
}

function lerPixels(desenho: SkImage): Uint8Array {
  try {
    const pixels = desenho.readPixels(0, 0, PIXELS_DA_ENTRADA);
    // O Skia devolve Float32Array nos formatos de ponto flutuante, e a conversão lê bytes.
    if (!(pixels instanceof Uint8Array)) {
      throw new Error('Não foi possível ler os pixels do desenho preparado.');
    }
    return pixels;
  } finally {
    desenho.dispose();
  }
}

// A entrada sai dos pontos dos traços que valem, e não do PNG que o profissional confere: no
// PNG, o tamanho e a posição do desenho no quadro mudam o escore (IA PR #29, Tabela 9).
export function prepararDesenho(tracos: readonly Traco[]): Float32Array {
  const ajustados = ajustarTracosNaEntrada(tracos);
  const superficie = Skia.Surface.Make(LADO_ENTRADA, LADO_ENTRADA);
  if (!superficie) throw new Error('Não foi possível criar a imagem de entrada do desenho.');

  // Superfície e imagens ocupam memória nativa, que o coletor do JavaScript não libera.
  try {
    const folha = superficie.getCanvas();
    folha.drawColor(Skia.Color(COR_DO_FUNDO_NA_ENTRADA));
    desenharTracos(folha, ajustados);
    superficie.flush();
    return pixelsParaEntrada(lerPixels(superficie.makeImageSnapshot()));
  } finally {
    superficie.dispose();
  }
}
