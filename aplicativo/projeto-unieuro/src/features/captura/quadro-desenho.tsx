/**
 * Quadro onde o paciente desenha.
 *
 * O traço em andamento é montado na thread de UI, com os pontos que o gesto
 * entrega, sem passar pelo JavaScript a cada ponto. É isso que mantém o traço
 * colado na caneta (história #9, cenário "traço na hora"). Quando o traço
 * termina, a lista de pontos vai de uma vez para a tela, que guarda o registro.
 */
import {
  Canvas,
  Path,
  Skia,
  usePathValue,
  type SkPath,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  acrescentarPonto,
  tracoParaCaminhoSvg,
  type PontoTracado,
  type TipoPonteiro,
  type Traco,
} from '@/features/captura/eventos-tracado';
import { ESPESSURA_TRACO, type Dimensoes } from '@/features/captura/imagem-desenho';

/** O quadro imita o papel: fundo branco e traço escuro, nos dois temas. */
const COR_FUNDO = '#FFFFFF';
const ESTILO_TRACO = {
  style: 'stroke',
  strokeWidth: ESPESSURA_TRACO,
  strokeCap: 'round',
  strokeJoin: 'round',
  color: '#0F172A',
} as const;

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

function montarCaminho(construtor: SkPathBuilder, pontos: readonly PontoTracado[]) {
  'worklet';
  if (pontos.length === 0) return;
  construtor.moveTo(pontos[0].x, pontos[0].y);
  // Um toque sem arrasto vira segmento de comprimento zero, que a ponta redonda mostra.
  const seguintes = pontos.length > 1 ? pontos.slice(1) : pontos;
  for (const ponto of seguintes) construtor.lineTo(ponto.x, ponto.y);
}

export function QuadroDesenho({ tracos, onTracoConcluido, onDimensoes }: QuadroDesenhoProps) {
  // `emAndamento` é o traço que a caneta está fazendo, e só a thread de UI o
  // zera, ao começar um traço novo. `aguardando` é o traço recém-concluído, que
  // fica na tela até a lista de traços recebida já o incluir. Se o JavaScript
  // zerasse o traço em andamento, um traço começado logo depois do anterior
  // perderia o começo, na tela e nos dados.
  const emAndamento = useSharedValue<PontoTracado[]>([]);
  const aguardando = useSharedValue<PontoTracado[]>([]);
  const ponteiro = useSharedValue<TipoPonteiro>('desconhecido');

  const caminhoEmAndamento = usePathValue((construtor) => {
    'worklet';
    montarCaminho(construtor, emAndamento.get());
  });
  const caminhoAguardando = usePathValue((construtor) => {
    'worklet';
    montarCaminho(construtor, aguardando.get());
  });

  // O Skia nativo lança erro, em vez de devolver null, quando não consegue ler o
  // caminho. Por isso traço vazio nem chega a ele.
  const caminhosConcluidos = useMemo(
    () =>
      tracos
        .filter((traco) => traco.length > 0)
        .map((traco) => Skia.Path.MakeFromSVGString(tracoParaCaminhoSvg(traco)))
        .filter((caminho): caminho is SkPath => caminho !== null),
    [tracos],
  );

  useEffect(() => {
    aguardando.set([]);
  }, [tracos, aguardando]);

  const arrasto = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin((evento) => {
      'worklet';
      ponteiro.set(tipoDoPonteiro(evento.pointerType));
      emAndamento.set([lerPonto(evento)]);
    })
    // A ativação do gesto chega no `onStart`, e não no `onUpdate`, e traz a
    // posição da caneta naquele instante: sem ela, o segundo ponto de cada traço
    // se perderia.
    .onStart((evento) => {
      'worklet';
      const ponto = lerPonto(evento);
      emAndamento.set((atuais) => acrescentarPonto(atuais, ponto));
    })
    .onUpdate((evento) => {
      'worklet';
      const ponto = lerPonto(evento);
      emAndamento.set((atuais) => acrescentarPonto(atuais, ponto));
    })
    .onFinalize(() => {
      'worklet';
      const concluidos = emAndamento.get();
      if (concluidos.length === 0) return;
      aguardando.set(concluidos);
      emAndamento.set([]);
      scheduleOnRN(onTracoConcluido, [...concluidos], ponteiro.get());
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
            <Path key={indice} path={caminho} {...ESTILO_TRACO} />
          ))}
          <Path path={caminhoAguardando} {...ESTILO_TRACO} />
          <Path path={caminhoEmAndamento} {...ESTILO_TRACO} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  quadro: { flex: 1, overflow: 'hidden', borderRadius: 16, backgroundColor: COR_FUNDO },
});
