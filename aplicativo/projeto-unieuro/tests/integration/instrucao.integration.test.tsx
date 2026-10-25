import { render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import DrawingRoute from '@/app/desenho';
import InstructionRoute from '@/app/instrucao';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { DRAWING_PENDING_MESSAGE } from '@/features/avaliacao/drawing-placeholder-screen';
import { TAREFAS } from '@/features/avaliacao/tarefas';
import { useConsentGate } from '@/features/avaliacao/use-consent-gate';

jest.mock('@/features/avaliacao/use-consent-gate', () => ({
  useConsentGate: jest.fn(() => 'liberado'),
}));

// Percorre as rotas da #8 como o paciente as vê: a instrução de cada tarefa e dela
// a área de desenho. Só a navegação é simulada (jest.setup.ts); cada passo lê os
// parâmetros que o anterior entregou ao roteador. O caminho do termo até a
// instrução está em tcle.integration.test.tsx, com o banco de verdade.

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

function renderizar(rota: React.ReactElement) {
  render(<SessionProvider initialProfessional={profissional}>{rota}</SessionProvider>);
}

function definirParametros(parametros: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(parametros);
}

afterEach(() => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  jest.mocked(useConsentGate).mockReturnValue('liberado');
});

describe.each(TAREFAS)('instrução da tarefa $numero', ({ numero, titulo, instrucao }) => {
  it('mostra o progresso e o texto, e só abre o desenho depois do "Começar"', async () => {
    const user = userEvent.setup();
    definirParametros({ atendimento: '12', tarefa: String(numero) });
    renderizar(<InstructionRoute />);

    expect(screen.getByText(`Tarefa ${numero} de 3`)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: titulo })).toBeOnTheScreen();
    expect(screen.getByText(instrucao)).toBeOnTheScreen();
    expect(useRouter().replace).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Começar' }));

    expect(useRouter().replace).toHaveBeenCalledTimes(1);
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/desenho',
      params: { atendimento: '12', tarefa: String(numero) },
    });
  });
});

describe('instrução sem avaliação em andamento', () => {
  it('volta ao início quando a rota abre sem atendimento', () => {
    definirParametros({ tarefa: '1' });
    renderizar(<InstructionRoute />);

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull();
  });

  it('volta ao início quando a tarefa não existe', () => {
    definirParametros({ atendimento: '12', tarefa: '7' });
    renderizar(<InstructionRoute />);

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });
});

describe('consentimento antes das tarefas', () => {
  it('sem decisão, volta ao TCLE e não mostra a instrução', () => {
    jest.mocked(useConsentGate).mockReturnValue('aguardando_consentimento');
    definirParametros({ atendimento: '12', tarefa: '1' });

    renderizar(<InstructionRoute />);

    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/tcle',
      params: { atendimento: '12' },
    });
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull();
  });

  it('depois da recusa, volta ao menu e não mostra a instrução', () => {
    jest.mocked(useConsentGate).mockReturnValue('bloqueado');
    definirParametros({ atendimento: '12', tarefa: '1' });

    renderizar(<InstructionRoute />);

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull();
  });
});

describe('destino do "Começar"', () => {
  it('é a área de desenho provisória', () => {
    renderizar(<DrawingRoute />);

    expect(screen.getByRole('header', { name: 'Área de desenho' })).toBeOnTheScreen();
    expect(screen.getByLabelText(`Informação. ${DRAWING_PENDING_MESSAGE}`)).toBeOnTheScreen();
  });
});
