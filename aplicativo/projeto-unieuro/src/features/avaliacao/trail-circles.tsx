/**
 * Círculos das trilhas desenhados no fundo do quadro, por baixo dos
 * traços do paciente. Todos têm a mesma aparência, para não indicar o próximo.
 */
import { Circle, Group, Text, matchFont } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { CORES_DA_TAREFA } from '@/features/avaliacao/drawing-task.styles';
import { RAIO_CIRCULO, posicionarCirculos } from '@/features/avaliacao/trilhas';
import type { Dimensoes } from '@/features/captura/quadro-desenho';

/** Mesmo azul-noite do traço, sobre o fundo branco do quadro. */
const COR_CONTORNO = CORES_DA_TAREFA.text;
const COR_FUNDO = CORES_DA_TAREFA.surface;
const ESPESSURA_CONTORNO = 2;

export const TAMANHO_ROTULO = 20;

export type TrailCirclesProps = {
  /** Tamanho do quadro. Enquanto ele não foi medido, nada é desenhado. */
  dimensoes: Dimensoes | null;
};

export function TrailCircles({ dimensoes }: Readonly<TrailCirclesProps>) {
  const fonte = useMemo(
    () => matchFont({ fontFamily: 'sans-serif', fontSize: TAMANHO_ROTULO, fontWeight: '600' }),
    [],
  );

  if (!dimensoes) return null;

  return (
    <Group>
      {posicionarCirculos(dimensoes).map(({ rotulo, x, y }) => {
        const caixa = fonte.measureText(rotulo);
        return (
          <Group key={rotulo}>
            <Circle cx={x} cy={y} r={RAIO_CIRCULO} color={COR_FUNDO} />
            <Circle
              cx={x}
              cy={y}
              r={RAIO_CIRCULO}
              color={COR_CONTORNO}
              style="stroke"
              strokeWidth={ESPESSURA_CONTORNO}
            />
            <Text
              x={x - caixa.x - caixa.width / 2}
              y={y - caixa.y - caixa.height / 2}
              text={rotulo}
              font={fonte}
              color={COR_CONTORNO}
            />
          </Group>
        );
      })}
    </Group>
  );
}
