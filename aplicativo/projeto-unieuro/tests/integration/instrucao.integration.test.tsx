import { render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import ConsentRoute from '@/app/tcle';
import DrawingRoute from '@/app/desenho';
import InstructionRoute from '@/app/instrucao';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { DRAWING_PENDING_MESSAGE } from '@/features/avaliacao/drawing-placeholder-screen';
import { TAREFAS } from '@/features/avaliacao/tarefas';

import { desenharNoQuadro, medirQuadro } from '../test-support/desenho';

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
});

describe('do termo de consentimento à instrução', () => {
  it('abre a tarefa 1 do atendimento que o registro entregou, depois da assinatura', async () => {
    const user = userEvent.setup();
    definirParametros({ atendimento: '12' });
    renderizar(<ConsentRoute />);

    medirQuadro(500, 160, 'Área de assinatura');
    await desenharNoQuadro([
      [10, 10],
      [90, 60],
    ]);
    await user.press(screen.getByRole('button', { name: 'Assinar e iniciar' }));

    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '1' },
    });
  });

  it('não abre nenhuma tarefa antes da assinatura', async () => {
    const user = userEvent.setup();
    definirParametros({ atendimento: '12' });
    renderizar(<ConsentRoute />);

    await user.press(screen.getByRole('button', { name: 'Assinar e iniciar' }));

    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('volta ao menu quando a recusa é confirmada, sem abrir tarefa', async () => {
    const user = userEvent.setup();
    definirParametros({ atendimento: '12' });
    renderizar(<ConsentRoute />);

    await user.press(screen.getByRole('button', { name: 'Recusar' }));
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    expect(useRouter().replace).toHaveBeenCalledTimes(1);
    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });
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

describe('destino do "Começar"', () => {
  it('é a área de desenho provisória', () => {
    renderizar(<DrawingRoute />);

    expect(screen.getByRole('header', { name: 'Área de desenho' })).toBeOnTheScreen();
    expect(screen.getByLabelText(`Informação. ${DRAWING_PENDING_MESSAGE}`)).toBeOnTheScreen();
  });
});
