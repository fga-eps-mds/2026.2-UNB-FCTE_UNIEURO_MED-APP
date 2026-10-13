import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';

import NewAttendanceRoute from '@/app/novo-exame';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { createProfessionalRepository } from '@/db/professional-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import type { AttendanceRepository } from '@/features/avaliacao/attendance';

import { createTempDatabase, type TempDatabase } from '../test-support/real-sqlite';
import { webCryptoAesGcm } from '../test-support/web-crypto-aes-gcm';

// Teste de ponta a ponta da #7: a rota "novo-exame", a tela, a regra e o banco
// SQLite de verdade, em arquivo. Só a navegação é simulada (jest.setup.ts).

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

// A rota usa o repositório da composição. Aqui ele aponta para o banco do teste.
let mockRepository: AttendanceRepository;
jest.mock('@/features/avaliacao/composition', () => ({
  get registerAttendanceRepository() {
    return mockRepository;
  },
}));

const CPF = '12345678909';
const protector = createCpfProtector(async () => new Uint8Array(32).fill(9), webCryptoAesGcm);

let temp: TempDatabase;
let database: SQLiteDatabase;
let professional: SessionProfessional;

beforeEach(async () => {
  temp = createTempDatabase();
  database = temp.open();
  await migrate(database, protector);

  const professionals = createProfessionalRepository(async () => database, protector);
  await professionals.insert({
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crmNumber: '12345',
    crmState: 'DF',
    cpf: '52998224725',
    passwordHash: 'hash-da-senha',
    createdAt: '2026-10-01T12:00:00.000Z',
  });
  const saved = await professionals.findByEmail('ana.souza@unieuro.com.br');
  professional = {
    id: saved!.id,
    name: saved!.name,
    email: saved!.email,
    crmNumber: saved!.crmNumber,
    crmState: saved!.crmState,
  };

  mockRepository = createAttendanceRepository(async () => database, protector);
});

afterEach(async () => {
  await database.closeAsync();
  temp.cleanup();
});

type Usuario = ReturnType<typeof userEvent.setup>;

async function registrarPaciente(user: Usuario) {
  render(
    <SessionProvider initialProfessional={professional}>
      <NewAttendanceRoute />
    </SessionProvider>,
  );

  await user.type(screen.getByLabelText('Nome completo'), 'José Alves Martins');
  await user.type(screen.getByLabelText('CPF'), CPF);
  await user.type(screen.getByLabelText('Data de nascimento'), '14031948');
  await user.type(screen.getByLabelText('Escolaridade (anos)'), '5');
  await user.press(screen.getByRole('button', { name: 'Ir para o termo de consentimento' }));
}

describe('Registro do atendimento, de ponta a ponta', () => {
  it('Cenário: atendimento registrado — grava no banco com o médico logado e abre o termo', async () => {
    const user = userEvent.setup();

    await registrarPaciente(user);

    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledTimes(1));
    const attendance = await database.getFirstAsync<{
      id: number;
      id_profissional: number;
      estado: string;
      nome: string;
      numero_ficha: string;
      data_nascimento: string;
      escolaridade_anos: number;
      sexo: string | null;
    }>(
      `SELECT a.id, a.id_profissional, a.estado, p.nome, p.numero_ficha, p.data_nascimento,
              p.escolaridade_anos, p.sexo
         FROM avaliacao a JOIN paciente p ON p.id = a.id_paciente`,
    );

    expect(attendance).toEqual({
      id: expect.any(Number),
      id_profissional: professional.id,
      estado: 'aguardando_consentimento',
      nome: 'José Alves Martins',
      numero_ficha: `${new Date().getFullYear()}-0001`,
      data_nascimento: '1948-03-14',
      escolaridade_anos: 5,
      sexo: null,
    });
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/tcle',
      params: { atendimento: String(attendance!.id) },
    });
  });

  it('não deixa o CPF do paciente legível no arquivo do banco', async () => {
    const user = userEvent.setup();

    await registrarPaciente(user);
    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledTimes(1));
    await database.closeAsync();
    const cpfVisible = temp.rawContains(CPF);
    database = temp.open();

    expect(cpfVisible).toBe(false);
    await expect(mockRepository.findPatientByCpf(CPF)).resolves.toEqual({
      id: expect.any(Number),
    });
  });

  it('reaproveita o paciente que volta e cria um novo atendimento', async () => {
    const user = userEvent.setup();

    await registrarPaciente(user);
    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledTimes(1));
    screen.unmount();
    await registrarPaciente(user);
    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledTimes(2));

    const totals = await database.getFirstAsync<{ pacientes: number; atendimentos: number }>(
      `SELECT (SELECT count(*) FROM paciente) AS pacientes,
              (SELECT count(*) FROM avaliacao) AS atendimentos`,
    );
    expect(totals).toEqual({ pacientes: 1, atendimentos: 2 });
  });
});
