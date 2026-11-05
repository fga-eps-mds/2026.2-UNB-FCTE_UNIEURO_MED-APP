import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createAttendanceRepository } from '@/db/attendance-repository';
import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { createProfessionalRepository } from '@/db/professional-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import type { ProfessionalCpfRepository } from '@/features/avaliacao/confirmacao-profissional';
import TelaFinalScreen, {
  BOTAO_PROFISSIONAL,
  FALHA_NA_CONFERENCIA,
} from '@/features/avaliacao/tela-final-screen';

import { createTempDatabase, type TempDatabase } from '../test-support/real-sqlite';
import { webCryptoAesGcm } from '../test-support/web-crypto-aes-gcm';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const ROTULO_CPF = 'Quatro primeiros dígitos do CPF';
const CPF_PROFISSIONAL = '11144477735';
const protector = createCpfProtector(async () => new Uint8Array(32).fill(4), webCryptoAesGcm);

let temp: TempDatabase;
let database: SQLiteDatabase;
let professional: SessionProfessional;
let professionalRepository: ReturnType<typeof createProfessionalRepository>;
let attendanceId: number;

beforeEach(async () => {
  temp = createTempDatabase();
  database = temp.open();
  await migrate(database, protector);

  professionalRepository = createProfessionalRepository(async () => database, protector);
  await professionalRepository.insert({
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crmNumber: '12345',
    crmState: 'DF',
    cpf: CPF_PROFISSIONAL,
    passwordHash: 'hash-da-senha',
    createdAt: '2026-10-30T12:00:00.000Z',
  });
  const saved = await professionalRepository.findByEmail('ana.souza@unieuro.com.br');
  professional = {
    id: saved!.id,
    name: saved!.name,
    email: saved!.email,
    crmNumber: saved!.crmNumber,
    crmState: saved!.crmState,
  };

  const attendances = createAttendanceRepository(async () => database, protector);
  ({ attendanceId } = await attendances.createAttendance({
    patient: {
      name: 'João da Silva',
      cpf: '52998224725',
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
  await database.closeAsync();
  temp.cleanup();
});

async function dadosColetados() {
  return database.getFirstAsync<{
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

function renderizar(repository: ProfessionalCpfRepository = professionalRepository) {
  render(
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

const DADOS_INTACTOS = { atendimento: 1, tarefas: 1, desenhos: 1, eventos: 1 };

describe('preservação do atendimento na confirmação final', () => {
  it('dígitos incorretos não apagam o atendimento nem os dados coletados', async () => {
    renderizar();
    const user = await abrirConfirmacao();

    await user.type(screen.getByLabelText(ROTULO_CPF), '9999');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    await expect(dadosColetados()).resolves.toEqual(DADOS_INTACTOS);
    expect(useRouter().dismissTo).not.toHaveBeenCalled();
  });

  it('cancelar não apaga o atendimento nem os dados coletados', async () => {
    renderizar();
    const user = await abrirConfirmacao();

    await user.type(screen.getByLabelText(ROTULO_CPF), '1114');
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    await expect(dadosColetados()).resolves.toEqual(DADOS_INTACTOS);
    expect(useRouter().dismissTo).not.toHaveBeenCalled();
  });

  it('falha na leitura do CPF preserva os dados e permite tentar novamente', async () => {
    const getCpf = jest.fn(
      async (_professionalId: number): Promise<string | null> => CPF_PROFISSIONAL,
    );
    getCpf.mockRejectedValueOnce(new Error('leitura indisponível'));
    const repository = { getCpf };
    renderizar(repository);
    const user = await abrirConfirmacao();

    await user.type(screen.getByLabelText(ROTULO_CPF), '1114');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByLabelText(`Erro. ${FALHA_NA_CONFERENCIA}`)).toBeOnTheScreen();
    await expect(dadosColetados()).resolves.toEqual(DADOS_INTACTOS);
    expect(useRouter().dismissTo).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Confirmar' }));
    expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu');
  });
});
