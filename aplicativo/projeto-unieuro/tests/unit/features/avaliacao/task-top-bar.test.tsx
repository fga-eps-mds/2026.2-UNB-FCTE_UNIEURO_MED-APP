import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { FALHA_AO_DESISTIR } from '@/features/avaliacao/desistir-dialog';
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

describe('desistência na barra das tarefas (#25)', () => {
  it('não mostra o "Desistir" quando a tela não grava a desistência', () => {
    render(<TaskTopBar numero={1} cores={Colors.light} />);

    expect(screen.queryByRole('button', { name: 'Desistir do exame' })).toBeNull();
  });

  it('pergunta antes de desistir e mostra em que tarefa o exame para', async () => {
    const user = userEvent.setup();
    const onDesistir = jest.fn(async () => {});
    render(<TaskTopBar numero={2} cores={Colors.light} onDesistir={onDesistir} />);

    await user.press(screen.getByRole('button', { name: 'Desistir do exame' }));

    expect(screen.getByRole('header', { name: 'Desistir do exame?' })).toBeOnTheScreen();
    expect(screen.getByText('Tarefa 2 de 3 · Copie este cubo')).toBeOnTheScreen();
    expect(onDesistir).not.toHaveBeenCalled();
  });

  it('grava a desistência com o motivo escolhido', async () => {
    const user = userEvent.setup();
    const onDesistir = jest.fn(async () => {});
    render(<TaskTopBar numero={1} cores={Colors.light} onDesistir={onDesistir} />);

    await user.press(screen.getByRole('button', { name: 'Desistir do exame' }));
    await user.press(screen.getByRole('radio', { name: 'Mal-estar' }));
    await user.press(screen.getByRole('button', { name: 'Sim, desistir' }));

    expect(onDesistir).toHaveBeenCalledWith('mal_estar');
  });

  it('o motivo é opcional, e um segundo toque desmarca', async () => {
    const user = userEvent.setup();
    const onDesistir = jest.fn(async () => {});
    render(<TaskTopBar numero={1} cores={Colors.light} onDesistir={onDesistir} />);

    await user.press(screen.getByRole('button', { name: 'Desistir do exame' }));
    await user.press(screen.getByRole('radio', { name: 'Cansaço' }));
    expect(screen.getByRole('radio', { name: 'Cansaço' })).toBeChecked();
    await user.press(screen.getByRole('radio', { name: 'Cansaço' }));
    await user.press(screen.getByRole('button', { name: 'Sim, desistir' }));

    expect(onDesistir).toHaveBeenCalledWith(null);
  });

  it('"Continuar o exame" fecha a pergunta sem gravar nada', async () => {
    const user = userEvent.setup();
    const onDesistir = jest.fn(async () => {});
    render(<TaskTopBar numero={3} cores={Colors.light} onDesistir={onDesistir} />);

    await user.press(screen.getByRole('button', { name: 'Desistir do exame' }));
    await user.press(screen.getByRole('button', { name: 'Continuar o exame' }));

    expect(screen.queryByRole('header', { name: 'Desistir do exame?' })).toBeNull();
    expect(onDesistir).not.toHaveBeenCalled();
  });

  it('se a gravação falha, avisa e deixa tentar de novo', async () => {
    const user = userEvent.setup();
    const onDesistir = jest
      .fn<Promise<void>, [unknown]>()
      .mockRejectedValueOnce(new Error('banco'))
      .mockResolvedValueOnce();
    render(<TaskTopBar numero={1} cores={Colors.light} onDesistir={onDesistir} />);

    await user.press(screen.getByRole('button', { name: 'Desistir do exame' }));
    await user.press(screen.getByRole('button', { name: 'Sim, desistir' }));

    expect(await screen.findByLabelText(`Erro. ${FALHA_AO_DESISTIR}`)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Sim, desistir' }));
    expect(onDesistir).toHaveBeenCalledTimes(2);
  });
});
