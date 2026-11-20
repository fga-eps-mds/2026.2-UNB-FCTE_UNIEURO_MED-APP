import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { createAttendanceRepository } from '@/db/attendance-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import {
  DIGITOS_INCORRETOS,
  type ProfessionalCpfRepository,
} from '@/features/avaliacao/confirmacao-profissional';
import TelaFinalScreen, {
  BOTAO_PROFISSIONAL,
  FALHA_NA_CONFERENCIA,
} from '@/features/avaliacao/tela-final-screen';

import {
  ANA,
  CPF_DA_ANA,
  CPF_DO_BRUNO,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const ROTULO_CPF = 'Quatro primeiros dígitos do CPF';
const DADOS_INTACTOS = { atendimento: 1, tarefas: 1, desenhos: 1, eventos: 1 };

let tablet: TabletComAnaEBruno;
let professional: SessionProfessional;
let attendanceId: number;

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  const { database } = tablet;
  professional = { id: tablet.anaId, ...ANA };

  const attendances = createAttendanceRepository(async () => database, cpfProtector);
  ({ attendanceId } = await attendances.createAttendance({
    patient: {
      name: 'João da Silva',
      cpf: CPF_DO_BRUNO,
      birthDate: '1950-05-20',
      schoolingYears: 4,
      sex: 'masculino',
    },
    professionalId: professional.id,
    startedAt: '2026-10-30T12:30:00.000Z',
  }));

  await database.runAsync(
    `INSERT INTO tarefa
       (id_avaliacao, tipo, ordem, largura, altura, data_hora_inicio, data_hora_termino)
     VALUES (?, 'relogio', 1, 800, 600, ?, ?)`,
    [attendanceId, '2026-10-30T12:35:00.000Z', '2026-10-30T12:36:00.000Z'],
  );
  const task = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM tarefa WHERE id_avaliacao = ?',
    [attendanceId],
  );
  await database.runAsync(
    'INSERT INTO desenho (id_tarefa, imagem_final, data_hora_confirmacao) VALUES (?, ?, ?)',
    [task!.id, new Uint8Array([1, 2, 3]), '2026-10-30T12:36:00.000Z'],
  );
  await database.runAsync(
    `INSERT INTO evento_tracado
       (id_tarefa, ordem, tipo, ponteiro, coord_x, coord_y, instante)
     VALUES (?, 1, 'inicio', 'caneta', 10, 20, 100)`,
    [task!.id],
  );
});

afterEach(async () => {
  await tablet.fechar();
});

async function dadosColetados() {
  return tablet.database.getFirstAsync<{
    atendimento: number;
    tarefas: number;
    desenhos: number;
    eventos: number;
  }>(
    `SELECT COUNT(DISTINCT a.id) AS atendimento,
            COUNT(DISTINCT t.id) AS tarefas,
            COUNT(DISTINCT d.id) AS desenhos,
            COUNT(DISTINCT e.id) AS eventos
       FROM avaliacao a
       LEFT JOIN tarefa t ON t.id_avaliacao = a.id
       LEFT JOIN desenho d ON d.id_tarefa = t.id
       LEFT JOIN evento_tracado e ON e.id_tarefa = t.id
      WHERE a.id = ?`,
    [attendanceId],
  );
}

function renderizar(repository: ProfessionalCpfRepository = tablet.repository) {
  return render(
    <SessionProvider initialProfessional={professional}>
      <TelaFinalScreen repository={repository} />
    </SessionProvider>,
  );
}

async function abrirConfirmacao() {
  const user = userEvent.setup();
  await user.press(screen.getByRole('button', { name: BOTAO_PROFISSIONAL }));
  return user;
}

describe('preservação do atendimento na confirmação final', () => {
  it('dígitos incorretos não apagam o atendimento nem os dados coletados', async () => {
    renderizar();
    const user = await abrirConfirmacao();

    await user.type(screen.getByLabelText(ROTULO_CPF), '9999');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    // Espera a conferência com o CPF protegido terminar antes de olhar o banco.
    expect(await screen.findByLabelText(`Erro. ${DIGITOS_INCORRETOS}`)).toBeOnTheScreen();
    await expect(dadosColetados()).resolves.toEqual(DADOS_INTACTOS);
    expect(useRouter().dismissTo).not.toHaveBeenCalled();
  });

  it('cancelar não apaga o atendimento nem os dados coletados', async () => {
    renderizar();
    const user = await abrirConfirmacao();

    await user.type(screen.getByLabelText(ROTULO_CPF), CPF_DA_ANA.slice(0, 4));
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('button', { name: BOTAO_PROFISSIONAL })).toBeOnTheScreen();
    await expect(dadosColetados()).resolves.toEqual(DADOS_INTACTOS);
    expect(useRouter().dismissTo).not.toHaveBeenCalled();
  });

  it('esquecer a confirmação não apaga o atendimento nem os dados coletados', async () => {
    const { unmount } = renderizar();

    // O profissional não confirma e a tela final é fechada.
    unmount();

    await expect(dadosColetados()).resolves.toEqual(DADOS_INTACTOS);
    expect(useRouter().dismissTo).not.toHaveBeenCalled();
  });

  it('falha na leitura do CPF preserva os dados e permite tentar novamente', async () => {
    const getCpf = jest.fn((id: number) => tablet.repository.getCpf(id));
    getCpf.mockRejectedValueOnce(new Error('leitura indisponível'));
    renderizar({ getCpf });
    const user = await abrirConfirmacao();

    await user.type(screen.getByLabelText(ROTULO_CPF), CPF_DA_ANA.slice(0, 4));
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByLabelText(`Erro. ${FALHA_NA_CONFERENCIA}`)).toBeOnTheScreen();
    await expect(dadosColetados()).resolves.toEqual(DADOS_INTACTOS);
    expect(useRouter().dismissTo).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu'));
    expect(getCpf).toHaveBeenCalledTimes(2);
  });
});
