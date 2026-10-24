import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { BackHandler } from 'react-native';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { DICA_CONFIRMAR } from '@/features/avaliacao/drawing-task';
import DrawingTaskScreen from '@/features/avaliacao/drawing-task-screen';
import { HELP_MESSAGE } from '@/features/avaliacao/task-top-bar';
import type { ParametroDeRota } from '@/features/avaliacao/tarefas';

import { DADOS_DA_CANETA, PointerType, desenharNoQuadro } from '../../../test-support/desenho';

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

type Opcoes = {
  tarefa?: ParametroDeRota;
  atendimento?: ParametroDeRota;
  professional?: SessionProfessional | null;
};

// Os valores padrão entram por mesclagem, e não por parâmetro padrão, para que um
// `undefined` passado de propósito (parâmetro ausente) chegue à tela como ausente.
function renderizarTela(opcoes: Opcoes = {}) {
  const { tarefa, atendimento, professional } = {
    tarefa: '1',
    atendimento: '12',
    professional: profissional,
    ...opcoes,
  };
  const onConfirmar = jest.fn();

  render(
    <SessionProvider initialProfessional={professional}>
      <DrawingTaskScreen tarefa={tarefa} atendimento={atendimento} onConfirmar={onConfirmar} />
    </SessionProvider>,
  );
  return { onConfirmar };
}

const botaoConfirmar = () => screen.getByRole('button', { name: 'Confirmar' });

describe('Cenário: confirmar sem desenho', () => {
  it.each(['1', '2'])(
    'deixa o "Confirmar" desabilitado na tarefa %s sem nenhum traço',
    (tarefa) => {
      renderizarTela({ tarefa });

      expect(botaoConfirmar()).toBeDisabled();
    },
  );

  it('explica perto do botão o que falta para confirmar', () => {
    renderizarTela();

    expect(screen.getByText(DICA_CONFIRMAR)).toBeOnTheScreen();
    expect(botaoConfirmar()).toHaveAccessibleName('Confirmar');
    expect(botaoConfirmar().props.accessibilityHint).toBe(DICA_CONFIRMAR);
  });

  it('não entrega nada quando o paciente toca no botão desabilitado', async () => {
    const user = userEvent.setup();
    const { onConfirmar } = renderizarTela();

    await user.press(botaoConfirmar());

    expect(onConfirmar).not.toHaveBeenCalled();
  });
});

describe('Cenário: passar para a próxima tarefa', () => {
  it('habilita o "Confirmar" depois do primeiro traço e esconde a dica', async () => {
    renderizarTela();
    expect(screen.getByText(DICA_CONFIRMAR)).toBeVisible();

    await desenharNoQuadro([
      [10, 10],
      [60, 40],
    ]);

    expect(botaoConfirmar()).toBeEnabled();
    // Fora do leitor de tela, que já não precisa da dica, e transparente na tela.
    expect(screen.queryByText(DICA_CONFIRMAR)).toBeNull();
    expect(screen.getByText(DICA_CONFIRMAR, { includeHiddenElements: true })).not.toBeVisible();
    expect(botaoConfirmar().props.accessibilityHint).toBeUndefined();
  });

  it('mantém o espaço da dica depois do primeiro traço, para o quadro não mudar de tamanho', async () => {
    renderizarTela();
    const dica = screen.getByText(DICA_CONFIRMAR);

    await desenharNoQuadro([[10, 10]]);

    // O mesmo texto continua na árvore, só transparente e fora do leitor de tela.
    expect(screen.getByText(DICA_CONFIRMAR, { includeHiddenElements: true })).toBe(dica);
    expect(dica.props.accessibilityElementsHidden).toBe(true);
    expect(dica.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('entrega a tarefa e o desenho a quem navega só depois do toque em "Confirmar"', async () => {
    const user = userEvent.setup();
    const { onConfirmar } = renderizarTela({ tarefa: '2' });

    await desenharNoQuadro([
      [10, 10],
      [60, 40],
    ]);
    expect(onConfirmar).not.toHaveBeenCalled();

    await user.press(botaoConfirmar());

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    const [tarefa, registro] = onConfirmar.mock.calls[0];
    expect(tarefa.numero).toBe(2);
    expect(registro.tracos).toHaveLength(1);
    expect(registro.tracos[0].map(({ x, y }: { x: number; y: number }) => [x, y])).toEqual([
      [10, 10],
      [60, 40],
    ]);
  });

  it('não pula uma tarefa com o segundo toque antes de a tela sair', async () => {
    const user = userEvent.setup();
    const { onConfirmar } = renderizarTela();
    await desenharNoQuadro([[10, 10]]);

    await user.press(botaoConfirmar());
    await user.press(botaoConfirmar());

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(botaoConfirmar()).toBeDisabled();
  });

  it('não pula uma tarefa com dois toques no mesmo instante, antes de a tela atualizar', async () => {
    const { onConfirmar } = renderizarTela();
    await desenharNoQuadro([[10, 10]]);

    act(() => {
      fireEvent.press(botaoConfirmar());
      fireEvent.press(botaoConfirmar());
    });

    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });

  it('deixa de aceitar traço novo depois de confirmar', async () => {
    const user = userEvent.setup();
    renderizarTela();
    await desenharNoQuadro([[10, 10]]);

    await user.press(botaoConfirmar());

    expect(screen.getByLabelText('Área de desenho: desenhe um relógio')).toBeDisabled();
  });

  it('não navega sozinha: o destino é de quem recebe o desenho', async () => {
    const user = userEvent.setup();
    renderizarTela();
    await desenharNoQuadro([[10, 10]]);

    await user.press(botaoConfirmar());

    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(useRouter().push).not.toHaveBeenCalled();
  });
});

describe('Cenário: traço na hora', () => {
  it('guarda o traço feito com a caneta, que continua no desenho depois de levantá-la', async () => {
    const user = userEvent.setup();
    const { onConfirmar } = renderizarTela();

    await desenharNoQuadro(
      [
        [5, 5],
        [15, 25],
        [30, 30],
      ],
      PointerType.STYLUS,
    );
    await user.press(botaoConfirmar());

    const [, registro] = onConfirmar.mock.calls[0];
    expect(registro.tracos).toHaveLength(1);
    expect(registro.tracos[0]).toHaveLength(3);
    expect(registro.eventos[0]).toMatchObject({ tipo: 'inicio', ponteiro: 'caneta' });
    expect(registro.tracos[0][0].pressao).toBe(DADOS_DA_CANETA.pressure);
  });

  it('aceita o traço feito com o dedo', async () => {
    renderizarTela();

    await desenharNoQuadro([[5, 5]], PointerType.TOUCH);

    expect(botaoConfirmar()).toBeEnabled();
  });
});

describe('Cenário: figura de modelo do cubo', () => {
  it('mostra a figura do cubo ao lado do quadro na cópia do cubo', () => {
    renderizarTela({ tarefa: '2' });

    expect(screen.getByText('Copie esta figura')).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Cubo para copiar' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Área de desenho: copie o cubo')).toBeOnTheScreen();
  });

  it('mantém a figura na tela durante toda a tarefa, também depois dos traços', async () => {
    renderizarTela({ tarefa: '2' });

    await desenharNoQuadro([
      [10, 10],
      [80, 10],
    ]);
    await desenharNoQuadro([
      [80, 10],
      [80, 80],
    ]);

    expect(screen.getByRole('image', { name: 'Cubo para copiar' })).toBeOnTheScreen();
  });

  it('não mostra figura de modelo no relógio', () => {
    renderizarTela({ tarefa: '1' });

    expect(screen.queryByRole('image', { name: 'Cubo para copiar' })).toBeNull();
    expect(screen.queryByText('Copie esta figura')).toBeNull();
  });
});

describe('o que a tela mostra ao paciente', () => {
  it('mostra o progresso, a frase de ajuda e o lembrete do relógio', () => {
    renderizarTela({ tarefa: '1' });

    expect(screen.getByText('Tarefa 1 de 3')).toBeOnTheScreen();
    expect(screen.getByText(HELP_MESSAGE)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Desenhe um relógio' })).toBeOnTheScreen();
    expect(screen.getByText('Com todos os números, marcando 11h10.')).toBeOnTheScreen();
  });

  it('mostra o progresso e o lembrete do cubo', () => {
    renderizarTela({ tarefa: '2' });

    expect(screen.getByText('Tarefa 2 de 3')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Copie o cubo' })).toBeOnTheScreen();
    expect(screen.getByText('Desenhe do jeito que você consegue.')).toBeOnTheScreen();
  });

  it('não mostra escore, resultado nem tempo', () => {
    renderizarTela({ tarefa: '2' });

    expect(screen.queryByText(/escore|resultado|pontua|segundo|minuto/i)).toBeNull();
  });
});

describe('botão voltar do Android', () => {
  afterEach(() => jest.restoreAllMocks());

  it('não sai da tarefa nem leva o paciente à área do profissional', async () => {
    const inscrever = jest.spyOn(BackHandler, 'addEventListener');
    const { onConfirmar } = renderizarTela({ tarefa: '2' });
    await desenharNoQuadro([[10, 10]]);

    const [, aoVoltar] = inscrever.mock.calls[inscrever.mock.calls.length - 1];
    expect(aoVoltar({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);

    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(useRouter().back).not.toHaveBeenCalled();
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(screen.getByRole('image', { name: 'Cubo para copiar' })).toBeOnTheScreen();
  });
});

describe('tela sem avaliação em andamento', () => {
  it('volta ao login sem médico na sessão', () => {
    renderizarTela({ professional: null });

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull();
  });

  it('volta ao início sem atendimento', () => {
    renderizarTela({ atendimento: undefined });

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull();
  });

  it.each([['3'], ['7'], [undefined]])(
    'volta ao início com a tarefa %s, que não tem esta tela',
    (tarefa) => {
      renderizarTela({ tarefa });

      expect(useRouter().replace).toHaveBeenCalledWith('/menu');
      expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull();
    },
  );
});
