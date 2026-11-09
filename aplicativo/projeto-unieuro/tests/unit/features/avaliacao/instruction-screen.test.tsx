import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { BackHandler, ScrollView, useWindowDimensions } from 'react-native';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import InstructionScreen, { HELP_MESSAGE } from '@/features/avaliacao/instruction-screen';
import { getInstructionLayout } from '@/features/avaliacao/instruction.styles';
import { TAREFAS, type ParametroDeRota } from '@/features/avaliacao/tarefas';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 1280, height: 800, scale: 1, fontScale: 1 })),
}));

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
  const onStart = jest.fn();

  render(
    <SessionProvider initialProfessional={professional}>
      <InstructionScreen tarefa={tarefa} atendimento={atendimento} onStart={onStart} />
    </SessionProvider>,
  );
  return { onStart };
}

describe('Cenário: instrução antes de cada tarefa', () => {
  it('mostra o título, uma frase de instrução e o botão "Começar"', () => {
    renderizarTela({ tarefa: '1' });

    expect(screen.getByRole('header', { name: 'Desenhe um relógio' })).toBeOnTheScreen();
    expect(screen.getByText(TAREFAS[0].instrucao)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Começar' })).toBeOnTheScreen();
  });

  it('não abre a área de desenho antes do toque em "Começar"', () => {
    const { onStart } = renderizarTela();

    expect(screen.queryByLabelText('Quadro de desenho')).toBeNull();
    expect(onStart).not.toHaveBeenCalled();
    expect(useRouter().push).not.toHaveBeenCalled();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('entrega a tarefa a quem navega só depois do toque em "Começar"', async () => {
    const user = userEvent.setup();
    const { onStart } = renderizarTela({ tarefa: '2' });

    await user.press(screen.getByRole('button', { name: 'Começar' }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(TAREFAS[1]);
  });

  it('lembra o paciente de chamar o profissional se precisar de ajuda', () => {
    renderizarTela();

    expect(screen.getByText(HELP_MESSAGE)).toBeOnTheScreen();
  });
});

describe('Cenário: texto de cada instrução', () => {
  it.each([
    [
      '1',
      'o relógio',
      'Desenhe um relógio',
      'Desenhe o círculo, coloque todos os números e marque onze horas e dez minutos.',
    ],
    [
      '2',
      'a cópia do cubo',
      'Copie este cubo',
      'Olhe a figura que aparece ao lado e desenhe igual, do jeito que você consegue.',
    ],
    [
      '3',
      'as trilhas',
      'Ligue números e letras',
      'Alterne número e letra, em ordem: 1, A, 2, B… até o E.',
    ],
  ])('quando a tarefa é %s (%s), mostra o texto combinado', (tarefa, _nome, titulo, instrucao) => {
    renderizarTela({ tarefa });

    expect(screen.getByRole('header', { name: titulo })).toBeOnTheScreen();
    expect(screen.getByText(instrucao)).toBeOnTheScreen();
  });
});

describe('Cenário: progresso', () => {
  it.each([
    ['1', 'Tarefa 1 de 3'],
    ['2', 'Tarefa 2 de 3'],
    ['3', 'Tarefa 3 de 3'],
  ])('no topo da tarefa %s, mostra "%s"', (tarefa, progresso) => {
    renderizarTela({ tarefa });

    expect(screen.getByText(progresso)).toBeOnTheScreen();
  });

  it('não repete o progresso para o leitor de tela', () => {
    renderizarTela({ tarefa: '3' });

    // O cartão repete o texto do topo só para o olho; o leitor de tela lê uma vez.
    expect(screen.getAllByText('Tarefa 3 de 3', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getAllByText('Tarefa 3 de 3')).toHaveLength(1);
  });
});

describe('botão voltar do Android', () => {
  afterEach(() => jest.restoreAllMocks());

  it('não sai da instrução nem leva o paciente à área do profissional', () => {
    const inscrever = jest.spyOn(BackHandler, 'addEventListener');
    const { onStart } = renderizarTela({ tarefa: '2' });

    const [, aoVoltar] = inscrever.mock.calls[inscrever.mock.calls.length - 1];
    expect(aoVoltar({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);

    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(useRouter().back).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Começar' })).toBeOnTheScreen();
  });
});

describe('quando a tela não pode ser mostrada', () => {
  it('volta ao login sem médico logado', () => {
    renderizarTela({ professional: null });

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull();
  });

  it.each([
    ['uma tarefa que não existe', { tarefa: '4' }],
    ['uma tarefa ausente', { tarefa: undefined }],
    ['uma avaliação ausente', { atendimento: undefined }],
    ['uma avaliação vazia', { atendimento: '' }],
  ])('volta ao início com %s', (_caso, parametros) => {
    renderizarTela(parametros);

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull();
  });
});

describe('Instrução proporcional ao tamanho da tela (#109)', () => {
  const telas = [
    ['tablet deitado', 1280, 800],
    ['tablet em pé', 800, 1280],
    ['celular', 360, 740],
  ] as const;

  function naTela(largura: number, altura: number) {
    jest
      .mocked(useWindowDimensions)
      .mockReturnValue({ width: largura, height: altura, scale: 1, fontScale: 1 });
  }

  afterEach(() => naTela(1280, 800));

  it.each(telas)(
    'no %s, o cartão usa as medidas calculadas para a tela',
    (_nome, largura, altura) => {
      naTela(largura, altura);
      renderizarTela();
      const layout = getInstructionLayout(largura, altura);

      const cartao = screen.getByTestId('cartao-instrucao');
      expect(cartao).toHaveStyle({
        maxWidth: layout.larguraCartao,
        padding: layout.padding,
        gap: layout.espaco,
      });
    },
  );

  it.each(telas)(
    'no %s, mostra a instrução inteira e o botão "Começar"',
    (_nome, largura, altura) => {
      naTela(largura, altura);
      renderizarTela();

      expect(screen.getByText(TAREFAS[0].instrucao)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Começar' })).toBeOnTheScreen();
    },
  );

  it('fica dentro de uma área que rola, para o celular não cortar a instrução nem o botão', () => {
    naTela(360, 740);
    renderizarTela();

    expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
  });

  it('recalcula as medidas quando o tablet gira', () => {
    naTela(1280, 800);
    renderizarTela();
    const deitado = screen.getByTestId('cartao-instrucao');
    expect(deitado).toHaveStyle({ gap: getInstructionLayout(1280, 800).espaco });

    naTela(800, 1280);
    screen.rerender(
      <SessionProvider initialProfessional={profissional}>
        <InstructionScreen tarefa="1" atendimento="12" onStart={jest.fn()} />
      </SessionProvider>,
    );
    const emPe = screen.getByTestId('cartao-instrucao');
    expect(emPe).toHaveStyle({ gap: getInstructionLayout(800, 1280).espaco });
  });
});
