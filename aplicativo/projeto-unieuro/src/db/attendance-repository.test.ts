import type { SQLiteDatabase } from 'expo-sqlite';

import { createAttendanceRepository, type PatientRecord } from '@/db/attendance-repository';
import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { createProfessionalRepository } from '@/db/professional-repository';
import { MIGRATIONS, SCHEMA_VERSION } from '@/db/schema';
import type { AttendanceRepository } from '@/features/avaliacao/attendance';

import { createTempDatabase, type TempDatabase } from '../../test-support/real-sqlite';
import { webCryptoAesGcm } from '../../test-support/web-crypto-aes-gcm';

// Testes de integração da #7 com SQLite de verdade, em arquivo: rodam as
// migrations reais, gravam pelo repositório e olham as tabelas e os bytes do
// arquivo, que é o que alguém veria ao copiar o banco do tablet.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const PATIENT_CPF = '52998224725';
const OTHER_CPF = '11144477735';
const STARTED_AT = '2026-10-09T14:32:00.000Z';

const protector = createCpfProtector(async () => new Uint8Array(32).fill(7), webCryptoAesGcm);

const newPatient = (overrides: Partial<PatientRecord> = {}): PatientRecord => ({
  name: 'José Alves Martins',
  cpf: PATIENT_CPF,
  recordNumber: '2026-0184',
  birthDate: '1948-03-14',
  schoolingYears: 5,
  sex: 'masculino',
  ...overrides,
});

let temp: TempDatabase;
let database: SQLiteDatabase;
let repository: ReturnType<typeof createAttendanceRepository>;
let professionalId: number;

async function insertProfessional() {
  const professionals = createProfessionalRepository(async () => database, protector);
  await professionals.insert({
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crmNumber: '12345',
    crmState: 'DF',
    cpf: OTHER_CPF,
    passwordHash: 'hash-da-senha',
    createdAt: '2026-09-26T13:00:00.000Z',
  });
  const saved = await professionals.findByEmail('ana.souza@unieuro.com.br');
  return saved!.id;
}

const countRows = async (table: 'paciente' | 'avaliacao') =>
  (await database.getFirstAsync<{ total: number }>(`SELECT count(*) AS total FROM ${table}`))!
    .total;

beforeEach(async () => {
  temp = createTempDatabase();
  database = temp.open();
  await migrate(database, protector);
  repository = createAttendanceRepository(async () => database, protector);
  professionalId = await insertProfessional();
});

afterEach(async () => {
  await database.closeAsync();
  temp.cleanup();
});

describe('contrato', () => {
  it('atende ao AttendanceRepository da regra do atendimento', () => {
    const contract: AttendanceRepository = repository;
    expect(typeof contract.findPatientByCpf).toBe('function');
    expect(typeof contract.createAttendance).toBe('function');
  });
});

describe('migration da versão 3', () => {
  it('cria as tabelas paciente e avaliacao num banco novo', async () => {
    const tables = await database.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );

    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining(['avaliacao', 'paciente', 'profissional']),
    );
    await expect(
      database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'),
    ).resolves.toEqual({ user_version: SCHEMA_VERSION });
  });

  it('leva um banco da versão 2 à versão 3 sem perder os profissionais', async () => {
    // Monta o banco como ele está hoje nos tablets: versões 1 e 2 aplicadas.
    const legacyTemp = createTempDatabase();
    const legacy = legacyTemp.open();
    const [schemaV1, protectCpfs] = MIGRATIONS;
    await legacy.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await legacy.execAsync(schemaV1 as string);
    if (typeof protectCpfs === 'function') await protectCpfs(legacy, protector);
    await legacy.execAsync('PRAGMA user_version = 2');
    await legacy.runAsync(
      `INSERT INTO profissional (nome, email, crm_numero, uf_crm, cpf_cifrado, cpf_indice, senha_hash, criacao, last_update)
       VALUES ('Bruno Lima', 'bruno@unieuro.com.br', '67890', 'GO', ?, ?, 'hash', '2026-09-28', '2026-09-28')`,
      [await protector.encrypt(OTHER_CPF), await protector.blindIndex(OTHER_CPF)],
    );

    await migrate(legacy, protector);

    const professional = await legacy.getFirstAsync<{ nome: string }>(
      'SELECT nome FROM profissional WHERE email = ?',
      ['bruno@unieuro.com.br'],
    );
    const patients = await legacy.getFirstAsync<{ total: number }>(
      'SELECT count(*) AS total FROM paciente',
    );
    expect(professional).toEqual({ nome: 'Bruno Lima' });
    expect(patients).toEqual({ total: 0 });
    await legacy.closeAsync();
    legacyTemp.cleanup();
  });

  it('recusa sexo fora das opções e escolaridade negativa', async () => {
    await expect(
      repository.createAttendance({
        patient: newPatient({ sex: 'outro' as PatientRecord['sex'] }),
        professionalId,
        startedAt: STARTED_AT,
      }),
    ).rejects.toThrow(/CHECK/);
    await expect(
      repository.createAttendance({
        patient: newPatient({ schoolingYears: -1 }),
        professionalId,
        startedAt: STARTED_AT,
      }),
    ).rejects.toThrow(/CHECK/);
  });
});

describe('Cenário: atendimento registrado', () => {
  it('grava o atendimento com o médico, o paciente, a data e hora de início e o estado inicial', async () => {
    const { attendanceId } = await repository.createAttendance({
      patient: newPatient(),
      professionalId,
      startedAt: STARTED_AT,
    });

    const attendance = await database.getFirstAsync<Record<string, unknown>>(
      'SELECT id, id_profissional, id_paciente, data_hora_inicio, estado FROM avaliacao WHERE id = ?',
      [attendanceId],
    );
    const patient = await repository.findPatientByCpf(PATIENT_CPF);

    expect(attendanceId).toBeGreaterThan(0);
    expect(attendance).toEqual({
      id: attendanceId,
      id_profissional: professionalId,
      id_paciente: patient!.id,
      data_hora_inicio: STARTED_AT,
      estado: 'aguardando_consentimento',
    });
  });

  it('aceita paciente sem sexo informado, que não é obrigatório', async () => {
    await repository.createAttendance({
      patient: newPatient({ sex: null }),
      professionalId,
      startedAt: STARTED_AT,
    });

    const row = await database.getFirstAsync<{ sexo: string | null }>(
      'SELECT sexo FROM paciente LIMIT 1',
    );
    expect(row).toEqual({ sexo: null });
  });

  it('falha com médico inexistente e não deixa o paciente novo gravado', async () => {
    await expect(
      repository.createAttendance({
        patient: newPatient(),
        professionalId: professionalId + 999,
        startedAt: STARTED_AT,
      }),
    ).rejects.toThrow(/FOREIGN KEY/);

    await expect(countRows('paciente')).resolves.toBe(0);
    await expect(countRows('avaliacao')).resolves.toBe(0);
  });
});

describe('paciente que volta', () => {
  it('é encontrado pelo CPF, com ou sem atendimento anterior', async () => {
    await expect(repository.findPatientByCpf(PATIENT_CPF)).resolves.toBeNull();

    await repository.createAttendance({
      patient: newPatient(),
      professionalId,
      startedAt: STARTED_AT,
    });

    await expect(repository.findPatientByCpf(PATIENT_CPF)).resolves.toEqual({
      id: expect.any(Number),
    });
    await expect(repository.findPatientByCpf(OTHER_CPF)).resolves.toBeNull();
  });

  it('ganha um novo atendimento sem duplicar o paciente', async () => {
    await repository.createAttendance({
      patient: newPatient(),
      professionalId,
      startedAt: STARTED_AT,
    });
    const existing = await repository.findPatientByCpf(PATIENT_CPF);

    const second = await repository.createAttendance({
      patient: existing!,
      professionalId,
      startedAt: '2026-10-16T09:00:00.000Z',
    });

    await expect(countRows('paciente')).resolves.toBe(1);
    await expect(countRows('avaliacao')).resolves.toBe(2);
    const row = await database.getFirstAsync<{ id_paciente: number }>(
      'SELECT id_paciente FROM avaliacao WHERE id = ?',
      [second.attendanceId],
    );
    expect(row).toEqual({ id_paciente: existing!.id });
  });

  it('não aceita um segundo cadastro com o mesmo CPF', async () => {
    await repository.createAttendance({
      patient: newPatient(),
      professionalId,
      startedAt: STARTED_AT,
    });

    await expect(
      repository.createAttendance({
        patient: newPatient({ name: 'Outro Nome', recordNumber: '2026-0999' }),
        professionalId,
        startedAt: STARTED_AT,
      }),
    ).rejects.toThrow(/UNIQUE/);
    await expect(countRows('paciente')).resolves.toBe(1);
  });
});

describe('Cenário: identificação mínima do paciente', () => {
  it('guarda só os seis dados do paciente, mais os campos de controle', async () => {
    const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(paciente)');

    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'nome',
      'cpf_cifrado',
      'cpf_indice',
      'numero_ficha',
      'data_nascimento',
      'escolaridade_anos',
      'sexo',
      'criacao',
      'last_update',
    ]);
  });

  it('não deixa o CPF do paciente legível no arquivo do banco', async () => {
    await repository.createAttendance({
      patient: newPatient(),
      professionalId,
      startedAt: STARTED_AT,
    });
    await database.closeAsync();
    const cpfVisible = temp.rawContains(PATIENT_CPF);
    // A ficha, gravada em texto, prova que o teste enxerga o conteúdo do arquivo.
    const recordVisible = temp.rawContains('2026-0184');
    database = temp.open();

    expect(cpfVisible).toBe(false);
    expect(recordVisible).toBe(true);
  });
});
