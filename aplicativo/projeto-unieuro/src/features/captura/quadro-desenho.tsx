/**
 * Quadro onde o paciente desenha.
 *
 * O traço em andamento é montado na thread de UI, com os pontos que o gesto
 * entrega, sem passar pelo JavaScript a cada ponto. É isso que mantém o traço
 * colado na caneta (história #9, cenário "traço na hora"). Quando o traço
 * termina, a lista de pontos vai de uma vez para a tela, que guarda o registro.
 */
import { Canvas, Path, Skia, usePathValue, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  tracoParaCaminhoSvg,
  type PontoTracado,
  type TipoPonteiro,
  type Traco,
} from '@/features/captura/eventos-tracado';
import { ESPESSURA_TRACO, type Dimensoes } from '@/features/captura/imagem-desenho';

/** O quadro imita o papel: fundo branco e traço escuro, nos dois temas. */
const COR_FUNDO = '#FFFFFF';
const COR_TRACO = '#0F172A';

type DadosDaCaneta = { pressure: number; tiltX: number; tiltY: number };

type EventoDoGesto = {
  x: number;
  y: number;
  pointerType: PointerType;
  stylusData?: DadosDaCaneta;
};

type QuadroDesenhoProps = {
  tracos: readonly Traco[];
  /** Pontos de um traço concluído, com o instante no relógio do aparelho, em milissegundos. */
  onTracoConcluido: (pontos: PontoTracado[], ponteiro: TipoPonteiro) => void;
  onDimensoes: (dimensoes: Dimensoes) => void;
};

function tipoDoPonteiro(tipo: PointerType): TipoPonteiro {
  'worklet';
  if (tipo === PointerType.STYLUS) return 'caneta';
  if (tipo === PointerType.TOUCH) return 'dedo';
  if (tipo === PointerType.MOUSE) return 'mouse';
  return 'desconhecido';
}

function lerPonto({ x, y, stylusData }: EventoDoGesto): PontoTracado {
  'worklet';
  const ponto: PontoTracado = { x, y, instante: Date.now() };
  if (stylusData) {
    ponto.pressao = stylusData.pressure;
    ponto.inclinacaoX = stylusData.tiltX;
    ponto.inclinacaoY = stylusData.tiltY;
  }
  return ponto;
}

export function QuadroDesenho({ tracos, onTracoConcluido, onDimensoes }: QuadroDesenhoProps) {
  const pontos = useSharedValue<PontoTracado[]>([]);
  const ponteiro = useSharedValue<TipoPonteiro>('desconhecido');

  const caminhoAtual = usePathValue((construtor) => {
    'worklet';
    const atuais = pontos.get();
    if (atuais.length === 0) return;
    construtor.moveTo(atuais[0].x, atuais[0].y);
    // Um toque sem arrasto vira segmento de comprimento zero, que a ponta redonda mostra.
    const seguintes = atuais.length > 1 ? atuais.slice(1) : atuais;
    for (const ponto of seguintes) construtor.lineTo(ponto.x, ponto.y);
  });

  const caminhosConcluidos = useMemo(
    () =>
      tracos
        .map((traco) => Skia.Path.MakeFromSVGString(tracoParaCaminhoSvg(traco)))
        .filter((caminho): caminho is SkPath => caminho !== null),
    [tracos],
  );

  // O traço em andamento só some depois que os traços recebidos já incluem o
  // traço concluído, para ele não piscar na passagem de uma thread para a outra.
  useEffect(() => {
    pontos.set([]);
  }, [tracos, pontos]);

  const arrasto = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin((evento) => {
      'worklet';
      ponteiro.set(tipoDoPonteiro(evento.pointerType));
      pontos.set([lerPonto(evento)]);
    })
    // A ativação do gesto chega no `onStart`, e não no `onUpdate`, e traz a
    // posição da caneta naquele instante: sem ela, o segundo ponto de cada traço
    // se perderia.
    .onStart((evento) => {
      'worklet';
      const ponto = lerPonto(evento);
      pontos.set((atuais) => [...atuais, ponto]);
    })
    .onUpdate((evento) => {
      'worklet';
      const ponto = lerPonto(evento);
      pontos.set((atuais) => [...atuais, ponto]);
    })
    .onFinalize(() => {
      'worklet';
      const concluidos = pontos.get();
      if (concluidos.length > 0) {
        scheduleOnRN(onTracoConcluido, [...concluidos], ponteiro.get());
      }
    })
    .withTestId('quadro-desenho');

  function medir({ nativeEvent }: LayoutChangeEvent) {
    onDimensoes({ largura: nativeEvent.layout.width, altura: nativeEvent.layout.height });
  }

  return (
    <GestureDetector gesture={arrasto}>
      <View
        accessible
        accessibilityLabel="Quadro de desenho"
        accessibilityHint="Desenhe com a caneta ou com o dedo"
        onLayout={medir}
        style={styles.quadro}>
        <Canvas style={StyleSheet.absoluteFill}>
          {caminhosConcluidos.map((caminho, indice) => (
            <Path
              key={indice}
              path={caminho}
              style="stroke"
              strokeWidth={ESPESSURA_TRACO}
              strokeCap="round"
              strokeJoin="round"
              color={COR_TRACO}
            />
          ))}
          <Path
            path={caminhoAtual}
            style="stroke"
            strokeWidth={ESPESSURA_TRACO}
            strokeCap="round"
            strokeJoin="round"
            color={COR_TRACO}
          />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  quadro: { flex: 1, overflow: 'hidden', borderRadius: 16, backgroundColor: COR_FUNDO },
});
