import { render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import ConsentRoute from '@/app/tcle';
import DrawingRoute from '@/app/desenho';
import InstructionRoute from '@/app/instrucao';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { LEMBRETES } from '@/features/avaliacao/drawing-task';
import { TAREFAS } from '@/features/avaliacao/tarefas';

// Percorre as rotas da #8 como o paciente as vê: do termo provisório à instrução
// de cada tarefa e dela à área de desenho. Só a navegação é simulada
// (jest.setup.ts); cada passo lê os parâmetros que o anterior entregou ao roteador.

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

describe('do termo provisório à instrução', () => {
  it('abre a tarefa 1 do atendimento que o registro entregou', async () => {
    const user = userEvent.setup();
    definirParametros({ atendimento: '12' });
    renderizar(<ConsentRoute />);

    await user.press(screen.getByRole('button', { name: 'Iniciar as tarefas' }));

    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '1' },
    });
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

describe.each(TAREFAS)('destino do "Começar" da tarefa $numero', ({ numero }) => {
  it('é a área de desenho da própria tarefa', () => {
    definirParametros({ atendimento: '12', tarefa: String(numero) });
    renderizar(<DrawingRoute />);

    const { titulo } = LEMBRETES[numero];
    expect(screen.getByLabelText(`Área de desenho: ${titulo.toLowerCase()}`)).toBeOnTheScreen();
  });
});
