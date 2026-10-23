import { act, fireEvent, screen } from '@testing-library/react-native';
import { PointerType, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

/**
 * Simula o paciente desenhando no `QuadroDesenho`, para os testes das telas que
 * usam o quadro: as tarefas de desenho (#9) e a assinatura do TCLE (#21).
 *
 *     await desenharNoQuadro([[10, 10], [20, 20]]);           // caneta
 *     await desenharNoQuadro([[5, 5]], PointerType.TOUCH);   // dedo
 *
 * Os substitutos de gesto, Reanimated, Worklets e Skia já estão no
 * `jest.setup.ts`.
 */

export { PointerType };

/** O que a caneta informa a cada ponto: pressão de 0 a 1 e inclinação em graus. */
export const DADOS_DA_CANETA = {
  pressure: 0.6,
  tiltX: 12,
  tiltY: -3,
  azimuthAngle: 0,
  altitudeAngle: 1,
};

/**
 * Faz um traço que passa pelos pontos dados e espera o traço chegar a quem guarda
 * o registro, o que no aplicativo acontece fora da thread do gesto.
 */
export async function desenharNoQuadro(
  pontos: readonly (readonly [number, number])[],
  ponteiro: PointerType = PointerType.STYLUS,
) {
  const caneta = ponteiro === PointerType.STYLUS ? { stylusData: DADOS_DA_CANETA } : {};
  const [[x0, y0], ...resto] = pontos;
  const [xFim, yFim] = pontos[pontos.length - 1];
  fireGestureHandler(getByGestureTestId('quadro-desenho'), [
    { state: State.BEGAN, x: x0, y: y0, pointerType: ponteiro, ...caneta },
    ...resto.map(([x, y]) => ({ state: State.ACTIVE, x, y, pointerType: ponteiro, ...caneta })),
    { state: State.END, x: xFim, y: yFim, pointerType: ponteiro },
  ]);
  await act(async () => {});
}

/** Informa o tamanho do quadro, como o aparelho faz quando a tela aparece. */
export function medirQuadro(largura = 800, altura = 600, rotulo = 'Quadro de desenho') {
  fireEvent(screen.getByLabelText(rotulo), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: largura, height: altura } },
  });
}
