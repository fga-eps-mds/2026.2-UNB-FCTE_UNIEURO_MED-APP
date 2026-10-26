import {
  ImageFormat,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';

import { COR_FUNDO, COR_TRACO, ESPESSURA_TRACO } from '@/features/captura/estilo-traco';
import { tracoParaCaminhoSvg, type Traco } from '@/features/captura/eventos-tracado';
import type { Dimensoes } from '@/features/captura/quadro-desenho';

export type AreaDaImagem = { x: number; y: number; largura: number; altura: number };

const MEIA_ESPESSURA = ESPESSURA_TRACO / 2;

export function areaDaImagem(
  tracos: readonly Traco[],
  { largura, altura }: Dimensoes,
): AreaDaImagem {
  // O gesto continua quando a caneta passa da borda do quadro. A imagem cresce até esses
  // pontos, com meia espessura de folga, para não cortar o traço (#10, "sem cortes").
  let esquerda = 0;
  let topo = 0;
  let direita = largura;
  let base = altura;
  for (const { x, y } of tracos.flat()) {
    esquerda = Math.min(esquerda, x - MEIA_ESPESSURA);
    topo = Math.min(topo, y - MEIA_ESPESSURA);
    direita = Math.max(direita, x + MEIA_ESPESSURA);
    base = Math.max(base, y + MEIA_ESPESSURA);
  }
  const x = Math.floor(esquerda);
  const y = Math.floor(topo);
  return { x, y, largura: Math.ceil(direita) - x, altura: Math.ceil(base) - y };
}

function temTamanho({ largura, altura }: AreaDaImagem) {
  return Number.isFinite(largura) && Number.isFinite(altura) && largura > 0 && altura > 0;
}

function criarPincel() {
  const pincel = Skia.Paint();
  pincel.setAntiAlias(true);
  pincel.setStyle(PaintStyle.Stroke);
  pincel.setStrokeWidth(ESPESSURA_TRACO);
  pincel.setStrokeCap(StrokeCap.Round);
  pincel.setStrokeJoin(StrokeJoin.Round);
  pincel.setColor(Skia.Color(COR_TRACO));
  return pincel;
}

function desenharTracos(folha: SkCanvas, tracos: readonly Traco[]) {
  const pincel = criarPincel();
  const tracosComPontos = tracos.filter((traco) => traco.length > 0);
  for (const traco of tracosComPontos) {
    const caminho = Skia.Path.MakeFromSVGString(tracoParaCaminhoSvg(traco));
    // Imagem sem um dos traços não pode ser gravada (#10, "tudo ou nada").
    if (!caminho) throw new Error('Não foi possível desenhar um traço na imagem do desenho.');
    folha.drawPath(caminho, pincel);
  }
}

function codificarPng(imagem: SkImage) {
  try {
    const png = imagem.encodeToBytes(ImageFormat.PNG);
    if (png.length === 0) throw new Error('Não foi possível gravar a imagem do desenho em PNG.');
    return png;
  } finally {
    imagem.dispose();
  }
}

export function gerarImagemDesenho(tracos: readonly Traco[], dimensoes: Dimensoes): Uint8Array {
  const area = areaDaImagem(tracos, dimensoes);
  if (!temTamanho(area)) throw new Error('Quadro sem tamanho para gerar a imagem do desenho.');

  // Um ponto de tela vira um pixel, sendo que esta é a imagem que o médico confere. A redução
  // para a entrada do modelo fica com o preparo da inferência.
  const superficie = Skia.Surface.Make(area.largura, area.altura);
  if (!superficie) throw new Error('Não foi possível criar a imagem do desenho.');

  // Superfície e imagem ocupam memória nativa, que o coletor do JavaScript não libera.
  try {
    const folha = superficie.getCanvas();
    folha.drawColor(Skia.Color(COR_FUNDO));
    folha.translate(-area.x, -area.y);
    desenharTracos(folha, tracos);
    superficie.flush();
    return codificarPng(superficie.makeImageSnapshot());
  } finally {
    superficie.dispose();
  }
}
