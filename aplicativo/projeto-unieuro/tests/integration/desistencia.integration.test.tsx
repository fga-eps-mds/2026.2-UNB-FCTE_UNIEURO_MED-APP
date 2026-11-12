import { act, render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import DrawingRoute from '@/app/desenho';
import ExameInterrompidoRoute from '@/app/exame-interrompido';
import InstructionRoute from '@/app/instrucao';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { giveUpExam, loadInterruptedExam, resumeExam } from '@/features/avaliacao/composition';

jest.mock('@/features/avaliacao/use-consent-gate', () => ({
  useConsentGate: jest.fn(() => 'liberado'),
}));
// O banco tem testes próprios (interruption-repository); aqui vale o caminho das rotas.
jest.mock('@/features/avaliacao/composition', () => ({
  giveUpExam: jest.fn(async () => {}),
  loadInterruptedExam: jest.fn(),
  resumeExam: jest.fn(),
}));
jest.mock('@/features/auth/composition', () => ({ credentialsRepository: {} }));
jest.mock('@/features/captura/composition', () => ({ confirmDrawing: jest.fn() }));

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

function renderizar(rota: React.ReactElement, parametros: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(parametros);
  render(<SessionProvider initialProfessional={profissional}>{rota}</SessionProvider>);
}

async function desistir(motivo?: string) {
  const user = userEvent.setup();
  await user.press(screen.getByRole('button', { name: 'Desistir do exame' }));
  if (motivo) await user.press(screen.getByRole('radio', { name: motivo }));
  await user.press(screen.getByRole('button', { name: 'Sim, desistir' }));
}

afterEach(() => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

describe('desistir e retomar o exame (#25)', () => {
  it('na instrução, grava a tarefa atual e o motivo e abre o exame interrompido', async () => {
    renderizar(<InstructionRoute />, { atendimento: '12', tarefa: '2' });

    await desistir('Não quis continuar');

    expect(giveUpExam).toHaveBeenCalledWith({
      atendimentoId: 12,
      tarefa: 2,
      motivo: 'nao_quis_continuar',
    });
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/exame-interrompido',
      params: { atendimento: '12' },
    });
  });

  it('no desenho, grava a tarefa do quadro sem salvar o desenho em curso', async () => {
    renderizar(<DrawingRoute />, { atendimento: '12', tarefa: '3' });

    await desistir();

    expect(giveUpExam).toHaveBeenCalledWith({ atendimentoId: 12, tarefa: 3, motivo: null });
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/exame-interrompido',
      params: { atendimento: '12' },
    });
  });

  it('se a gravação falha, fica na tarefa', async () => {
    jest.mocked(giveUpExam).mockRejectedValueOnce(new Error('O exame não estava em andamento.'));
    renderizar(<InstructionRoute />, { atendimento: '12', tarefa: '1' });

    await desistir();

    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Desistir do exame?' })).toBeOnTheScreen();
  });

  it('a retomada abre a instrução da tarefa em que o exame continua', async () => {
    jest.mocked(loadInterruptedExam).mockResolvedValue({
      atendimentoId: 12,
      nomePaciente: 'José Alves Martins',
      fichaPaciente: '2026-0001',
      tarefa: 2,
      motivo: null,
      interrompidoEm: '2026-11-12T14:06:00.000Z',
      tarefasGravadas: [1],
    });
    jest.mocked(resumeExam).mockResolvedValue({ retomado: true, tarefa: 2 });
    renderizar(<ExameInterrompidoRoute />, { atendimento: '12' });
    await act(async () => {});

    await userEvent.setup().press(screen.getByRole('button', { name: 'Retomar exame' }));

    expect(loadInterruptedExam).toHaveBeenCalledWith(12, 7);
    expect(resumeExam).toHaveBeenCalledWith(12, 7);
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '2' },
    });
  });
});
