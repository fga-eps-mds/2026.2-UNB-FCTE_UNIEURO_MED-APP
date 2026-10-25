import { render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import DrawingRoute from '@/app/desenho';
import InstructionRoute from '@/app/instrucao';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { useConsentGate } from '@/features/avaliacao/use-consent-gate';

import { desenharNoQuadro, medirQuadro } from '../test-support/desenho';

jest.mock('@/features/avaliacao/use-consent-gate', () => ({
  useConsentGate: jest.fn(() => 'liberado'),
}));

// Percorre as rotas da #9 como o paciente as vê: a instrução de cada tarefa, o
// desenho e o "Confirmar", que abre a instrução seguinte e, depois das trilhas, a
// tela final (#11). Só a navegação é simulada (jest.setup.ts): cada passo abre a
// rota com os parâmetros que o anterior entregou ao roteador.

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const ROTAS = { '/instrucao': InstructionRoute, '/desenho': DrawingRoute } as const;

type Destino = { pathname: keyof typeof ROTAS; params: Record<string, string> };

let montada = false;

// Só uma rota na tela por vez, como no aparelho: o `replace` troca a anterior, e a
// sessão do profissional continua a mesma.
function abrir({ pathname, params }: Destino) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
  const Rota = ROTAS[pathname];
  const arvore = (
    <SessionProvider initialProfessional={profissional}>
      <Rota key={`${pathname}-${params.tarefa}`} />
    </SessionProvider>
  );
  if (montada) screen.rerender(arvore);
  else render(arvore);
  montada = true;
}

/** Abre a rota para onde a tela atual mandou o paciente. */
function seguir() {
  const chamadas = jest.mocked(useRouter().replace).mock.calls;
  const destino = chamadas[chamadas.length - 1][0] as unknown as Destino;
  abrir(destino);
  return destino;
}

afterEach(() => {
  montada = false;
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  jest.mocked(useConsentGate).mockReturnValue('liberado');
});

describe('Cenário: ordem das tarefas', () => {
  it('passa pela instrução e pelo desenho do relógio, do cubo e das trilhas, nessa ordem, até a tela final', async () => {
    const user = userEvent.setup();
    abrir({ pathname: '/instrucao', params: { atendimento: '12', tarefa: '1' } });

    // Tarefa 1: relógio.
    expect(screen.getByRole('header', { name: 'Desenhe um relógio' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Começar' }));
    expect(seguir()).toEqual({ pathname: '/desenho', params: { atendimento: '12', tarefa: '1' } });
    expect(screen.getByText('Tarefa 1 de 3')).toBeOnTheScreen();
    expect(screen.getByLabelText('Área de desenho: desenhe um relógio')).toBeOnTheScreen();
    expect(screen.queryByRole('image', { name: 'Cubo para copiar' })).toBeNull();

    await desenharNoQuadro([
      [100, 100],
      [200, 100],
    ]);
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    // Tarefa 2: cópia do cubo, precedida pela instrução dela.
    expect(seguir()).toEqual({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '2' },
    });
    expect(screen.getByRole('header', { name: 'Copie este cubo' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Começar' }));
    expect(seguir()).toEqual({ pathname: '/desenho', params: { atendimento: '12', tarefa: '2' } });
    expect(screen.getByText('Tarefa 2 de 3')).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Cubo para copiar' })).toBeOnTheScreen();

    await desenharNoQuadro([
      [50, 50],
      [150, 150],
    ]);
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    // Tarefa 3: trilhas, com os círculos dentro do quadro.
    expect(seguir()).toEqual({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '3' },
    });
    expect(screen.getByRole('header', { name: 'Ligue números e letras' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Começar' }));
    expect(seguir()).toEqual({ pathname: '/desenho', params: { atendimento: '12', tarefa: '3' } });
    expect(screen.getByText('Tarefa 3 de 3')).toBeOnTheScreen();
    medirQuadro(1196, 540, 'Área de desenho: ligue números e letras');
    expect(
      screen.UNSAFE_root.findAll((no) => (no.type as string) === 'SkiaText', { deep: true }),
    ).toHaveLength(10);

    await desenharNoQuadro([
      [500, 245],
      [706, 54],
    ]);
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    // Depois da última tarefa, a tela final do paciente, sem escore.
    expect(useRouter().replace).toHaveBeenLastCalledWith('/fim-do-teste');
  });
});

describe('Cenário: passar para a próxima tarefa', () => {
  it.each([
    ['1', '2'],
    ['2', '3'],
  ])('o "Confirmar" da tarefa %s abre a instrução da tarefa %s', async (atual, seguinte) => {
    const user = userEvent.setup();
    abrir({ pathname: '/desenho', params: { atendimento: '12', tarefa: atual } });

    await desenharNoQuadro([[10, 10]]);
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(useRouter().replace).toHaveBeenCalledTimes(1);
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: seguinte },
    });
  });

  it('o "Confirmar" das trilhas abre a tela final, sem voltar às tarefas', async () => {
    const user = userEvent.setup();
    abrir({ pathname: '/desenho', params: { atendimento: '12', tarefa: '3' } });

    await desenharNoQuadro([[10, 10]]);
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(useRouter().replace).toHaveBeenCalledTimes(1);
    expect(useRouter().replace).toHaveBeenCalledWith('/fim-do-teste');
    expect(useRouter().push).not.toHaveBeenCalled();
  });
});

describe('Cenário: confirmar sem desenho', () => {
  it('não sai da tarefa enquanto não há traço', async () => {
    const user = userEvent.setup();
    abrir({ pathname: '/desenho', params: { atendimento: '12', tarefa: '1' } });

    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });
});
