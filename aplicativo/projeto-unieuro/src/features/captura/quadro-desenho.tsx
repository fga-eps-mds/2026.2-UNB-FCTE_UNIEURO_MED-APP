/**
 * Quadro onde o paciente desenha, usado nas três tarefas (#9) e na assinatura do
 * TCLE (#21).
 *
 * O traço em andamento é montado na thread de UI, com os pontos que o gesto
 * entrega, sem passar pelo JavaScript a cada ponto. É isso que mantém o traço
 * colado na caneta (história #9, cenário "traço na hora"). Quando o traço
 * termina, a lista de pontos vai de uma vez para quem guarda o registro, em geral
 * o `useRegistroTracado`.
 */
import {
  Canvas,
  Path,
  Skia,
  usePathValue,
  type SkPath,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, type ReactNode } from 'react';
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
import { COR_FUNDO, COR_TRACO, ESPESSURA_TRACO } from '@/features/captura/estilo-traco';

/** Tamanho do quadro na tela, em pontos. As coordenadas dos traços estão nessa escala. */
export type Dimensoes = { largura: number; altura: number };

/**
 * O quadro imita o papel e segue a área de desenho do guia de identidade visual:
 * fundo branco, traço azul-noite, borda decorativa, raio 24 e sombra de nível 1.
 * As cores não mudam com o tema, porque a tela de desenho é sempre clara.
 */
const COR_BORDA = '#CBD5E1';
const RAIO = 24;
const ESTILO_TRACO = {
  style: 'stroke',
  strokeWidth: ESPESSURA_TRACO,
  strokeCap: 'round',
  strokeJoin: 'round',
  color: COR_TRACO,
} as const;

type DadosDaCaneta = { pressure: number; tiltX: number; tiltY: number };

type EventoDoGesto = {
  x: number;
  y: number;
  pointerType: PointerType;
  stylusData?: DadosDaCaneta;
};

export type QuadroDesenhoProps = {
  tracos: readonly Traco[];
  /** Pontos de um traço concluído, com o instante no relógio do aparelho, em milissegundos. */
  onTracoConcluido: (pontos: PontoTracado[], ponteiro: TipoPonteiro) => void;
  onDimensoes: (dimensoes: Dimensoes) => void;
  /** Nome do quadro para o leitor de tela, por exemplo "Área de assinatura". */
  rotulo?: string;
  dica?: string;
  /** Mostra os traços, mas não aceita traço novo, por exemplo depois de confirmar o desenho. */
  desabilitado?: boolean;
  /**
   * Elementos do Skia desenhados dentro da área, por baixo dos traços, como os
   * círculos numerados das trilhas (#9). Usam as mesmas coordenadas dos traços:
   * posicione pelo tamanho do quadro (`dimensoes`).
   */
  fundo?: ReactNode;
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

/** Monta o traço em andamento na thread de UI. Exportada para os testes. */
export function montarCaminho(
  construtor: Pick<SkPathBuilder, 'moveTo' | 'lineTo'>,
  pontos: readonly PontoTracado[],
) {
  'worklet';
  if (pontos.length === 0) return;
  construtor.moveTo(pontos[0].x, pontos[0].y);
  // Um toque sem arrasto vira segmento de comprimento zero, que a ponta redonda mostra.
  const seguintes = pontos.length > 1 ? pontos.slice(1) : pontos;
  for (const ponto of seguintes) construtor.lineTo(ponto.x, ponto.y);
}

export function QuadroDesenho({
  tracos,
  onTracoConcluido,
  onDimensoes,
  rotulo = 'Quadro de desenho',
  dica = 'Desenhe com a caneta ou com o dedo',
  desabilitado = false,
  fundo,
}: QuadroDesenhoProps) {
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
    .enabled(!desabilitado)
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

  // A moldura leva a borda e a sombra; o quadro de dentro corta o traço nos
  // cantos arredondados, e é o tamanho dele que dá a escala das coordenadas.
  return (
    <View testID="moldura-quadro-desenho" style={styles.moldura}>
      <GestureDetector gesture={arrasto}>
        <View
          accessible
          accessibilityLabel={rotulo}
          accessibilityHint={dica}
          accessibilityState={{ disabled: desabilitado }}
          onLayout={medir}
          style={styles.quadro}>
          <Canvas style={StyleSheet.absoluteFill}>
            {fundo}
            {caminhosConcluidos.map((caminho, indice) => (
              <Path key={indice} path={caminho} {...ESTILO_TRACO} />
            ))}
            <Path path={caminhoAguardando} {...ESTILO_TRACO} />
            <Path path={caminhoEmAndamento} {...ESTILO_TRACO} />
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  moldura: {
    flex: 1,
    borderRadius: RAIO,
    borderWidth: 1,
    borderColor: COR_BORDA,
    backgroundColor: COR_FUNDO,
    boxShadow: '0px 4px 16px rgba(15, 23, 41, 0.06)',
  },
  quadro: { flex: 1, overflow: 'hidden', borderRadius: RAIO - 1 },
});
