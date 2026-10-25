import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { HELP_MESSAGE, TaskTopBar } from '@/features/avaliacao/task-top-bar';

describe('TaskTopBar', () => {
  it.each([1, 2, 3])('mostra "Tarefa %i de 3" e a frase de ajuda', (numero) => {
    render(<TaskTopBar numero={numero} cores={Colors.light} />);

    expect(screen.getByText(`Tarefa ${numero} de 3`)).toBeOnTheScreen();
    expect(screen.getByText(HELP_MESSAGE)).toBeOnTheScreen();
  });

  it('pinta um círculo por tarefa até a atual, e os seguintes ficam vazios', () => {
    render(<TaskTopBar numero={2} cores={Colors.light} />);

    const circulos = screen
      .UNSAFE_getAllByType(View)
      .map((no) => StyleSheet.flatten(no.props.style))
      .filter((estilo) => estilo?.width === 16 && estilo?.height === 16);
    expect(circulos.map((estilo) => estilo.backgroundColor)).toEqual([
      Colors.light.primary,
      Colors.light.primary,
      Colors.light.borderDecorative,
    ]);
  });

  it('esconde os círculos do leitor de tela, que já lê "Tarefa N de 3"', () => {
    render(<TaskTopBar numero={1} cores={Colors.light} />);

    const escondidos = screen
      .UNSAFE_getAllByType(View)
      .filter((no) => no.props.importantForAccessibility === 'no-hide-descendants');
    expect(escondidos).toHaveLength(1);
    expect(escondidos[0].props.accessibilityElementsHidden).toBe(true);
  });
});
