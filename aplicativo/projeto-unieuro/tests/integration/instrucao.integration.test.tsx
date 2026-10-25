import { act, render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import ConsentRoute from '@/app/tcle';
import DrawingRoute from '@/app/desenho';
import InstructionRoute from '@/app/instrucao';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { DRAWING_PENDING_MESSAGE } from '@/features/avaliacao/drawing-placeholder-screen';
import { TAREFAS } from '@/features/avaliacao/tarefas';
import { registerConsentDecision } from '@/features/avaliacao/composition';
import { useConsentGate } from '@/features/avaliacao/use-consent-gate';
import { gerarImagemDesenho } from '@/features/captura/imagem-desenho';

import { desenharNoQuadro, medirQuadro } from '../test-support/desenho';

jest.mock('@/features/avaliacao/use-consent-gate', () => ({
  useConsentGate: jest.fn(() => 'liberado'),
}));
// O banco e a imagem em PNG (Skia) não existem no Jest. A regra do consentimento e o
// repositório têm testes próprios; aqui vale o caminho das rotas.
jest.mock('@/features/avaliacao/composition', () => ({
  registerConsentDecision: jest.fn(),
  getAttendancePatient: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@/features/captura/imagem-desenho', () => ({ gerarImagemDesenho: jest.fn() }));

// Percorre as rotas da #8 e da #21 como o paciente as vê: do termo de consentimento à instrução
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
  jest.mocked(useConsentGate).mockReturnValue('liberado');
});

describe('do termo de consentimento à instrução', () => {
  const DECIDIDO_EM = '2026-10-25T12:00:00.000Z';

  beforeEach(() => {
    jest.mocked(useConsentGate).mockReturnValue('aguardando_consentimento');
    jest.mocked(gerarImagemDesenho).mockReturnValue(new Uint8Array([137, 80, 78, 71]));
  });

  it('abre a tarefa 1 do atendimento só depois da assinatura gravada', async () => {
    const user = userEvent.setup();
    jest
      .mocked(registerConsentDecision)
      .mockResolvedValue({ sucesso: true, estado: 'em_andamento', decididoEm: DECIDIDO_EM });
    definirParametros({ atendimento: '12' });
    renderizar(<ConsentRoute />);
    await act(async () => {});

    expect(useRouter().replace).not.toHaveBeenCalled();
    medirQuadro(520, 160, 'Área de assinatura');
    await desenharNoQuadro([
      [20, 80],
      [160, 100],
    ]);
    await user.press(screen.getByRole('button', { name: 'Assinar e iniciar' }));

    expect(registerConsentDecision).toHaveBeenCalledWith(
      expect.objectContaining({ atendimentoId: 12, aceito: true, quemAssina: 'paciente' }),
    );
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '1' },
    });
  });

  it('volta ao menu depois da recusa confirmada, sem abrir nenhuma tarefa', async () => {
    const user = userEvent.setup();
    jest
      .mocked(registerConsentDecision)
      .mockResolvedValue({ sucesso: true, estado: 'cancelada', decididoEm: DECIDIDO_EM });
    definirParametros({ atendimento: '12' });
    renderizar(<ConsentRoute />);
    await act(async () => {});

    await user.press(screen.getByRole('button', { name: 'Recusar' }));
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    expect(registerConsentDecision).toHaveBeenCalledWith(
      expect.objectContaining({ atendimentoId: 12, aceito: false }),
    );
    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
    expect(useRouter().replace).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/instrucao' }),
    );
  });

  it('não mostra o termo de novo quando o consentimento já foi aceito', async () => {
    jest.mocked(useConsentGate).mockReturnValue('liberado');
    definirParametros({ atendimento: '12' });
    renderizar(<ConsentRoute />);
    await act(async () => {});

    expect(screen.queryByRole('button', { name: 'Assinar e iniciar' })).toBeNull();
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
