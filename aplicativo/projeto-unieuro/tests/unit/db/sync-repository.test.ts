import type { SQLiteDatabase } from 'expo-sqlite';

import { createAttendanceRepository } from '@/db/attendance-repository';
import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { createProfessionalRepository } from '@/db/professional-repository';
import { createSyncRepository, type SyncOperations } from '@/db/sync-repository';

import { createTempDatabase, type TempDatabase } from '../../test-support/real-sqlite';
import { webCryptoAesGcm } from '../../test-support/web-crypto-aes-gcm';

// SQLite real. As regras de junção estão em apply-package.test.ts.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const protector = createCpfProtector(async () => new Uint8Array(32).fill(5), webCryptoAesGcm);
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000000';
const ANA_CPF = '11144477735';
const JOSE_CPF = '52998224725';

let temp: TempDatabase;
let database: SQLiteDatabase;
let operations: SyncOperations;

beforeEach(async () => {
  temp = createTempDatabase();
  database = temp.open();
  await migrate(database, protector);
  operations = await createSyncRepository(async () => database, protector).direct();
});

afterEach(async () => {
  await database.closeAsync();
  temp.cleanup();
});

async function registerAnaWithJose() {
  const professionals = createProfessionalRepository(async () => database, protector);
  await professionals.insert({
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crmNumber: '12345',
    crmState: 'DF',
    cpf: ANA_CPF,
    passwordHash: 'hash',
    createdAt: '2026-09-26T13:00:00.000Z',
  });
  const ana = await professionals.findByEmail('ana.souza@unieuro.com.br');
  await createAttendanceRepository(async () => database, protector).createAttendance({
    patient: {
      name: 'José Alves Martins',
      cpf: JOSE_CPF,
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'masculino',
    },
    professionalId: ana!.id,
    startedAt: '2026-10-09T14:32:00.000Z',
  });
}

describe('leitura para o pacote', () => {
  it('devolve os registros sem o id local e com o CPF decifrado', async () => {
    await registerAnaWithJose();

    const [professional] = await operations.listProfessionals();
    const [patient] = await operations.listPatients();
    const [attendance] = await operations.listAttendances();

    expect(professional).not.toHaveProperty('id');
    expect(professional).not.toHaveProperty('cpf_cifrado');
    expect(professional).toMatchObject({ cpf: ANA_CPF, origem_seq: 1 });
    expect(patient).toMatchObject({ cpf: JOSE_CPF, numero_ficha: '2026-0001', origem_seq: 2 });
    expect(attendance).toMatchObject({
      profissional_uuid: professional.uuid,
      paciente_uuid: patient.uuid,
      estado: 'aguardando_consentimento',
      origem_seq: 3,
    });
  });

  it('acha o profissional e o paciente pelo CPF, pelo índice deste tablet', async () => {
    await registerAnaWithJose();

    await expect(operations.findProfessionalByCpf(ANA_CPF)).resolves.toMatchObject({
      crm_numero: '12345',
    });
    await expect(operations.findPatientByCpf(JOSE_CPF)).resolves.toMatchObject({
      nome: 'José Alves Martins',
    });
    await expect(operations.findPatientByCpf('00000000000')).resolves.toBeNull();
  });
});

describe('vetor de versões', () => {
  it('inclui o que este tablet gravou e o que recebeu de outros', async () => {
    await registerAnaWithJose();
    const local = await operations.getLocalDeviceId();

    await operations.mergeVector({ [OTHER]: 4, [local]: 99 });

    await expect(operations.readVector()).resolves.toEqual({ [local]: 3, [OTHER]: 4 });
  });

  it('nunca volta o contador recebido de outro tablet', async () => {
    await operations.mergeVector({ [OTHER]: 7 });
    await operations.mergeVector({ [OTHER]: 2 });

    await expect(operations.readVector()).resolves.toMatchObject({ [OTHER]: 7 });
  });
});

describe('ficha do paciente recebido', () => {
  it('fica com a ficha de origem quando ela está livre', async () => {
    await expect(operations.recordNumberFor('2026-0007')).resolves.toBe('2026-0007');
  });

  it('ganha a próxima do mesmo ano quando a ficha já está em uso', async () => {
    await registerAnaWithJose();

    await expect(operations.recordNumberFor('2026-0001')).resolves.toBe('2026-0002');
  });
});

describe('unificação', () => {
  it('aplica a unificação de outro tablet, valendo o menor uuid', async () => {
    await registerAnaWithJose();
    const [ana] = await operations.listProfessionals();
    const smaller = '00000000-0000-4000-8000-000000000001';

    await operations.adoptAlias('profissional', { uuid_alias: ana.uuid, uuid_principal: smaller });

    await expect(operations.findProfessionalByUuid(ana.uuid)).resolves.toMatchObject({
      uuid: smaller,
    });
    await expect(operations.listAliases('profissional')).resolves.toEqual([
      { uuid_alias: ana.uuid, uuid_principal: smaller },
    ]);
  });

  it('não junta dois cadastros que já existem separados neste tablet', async () => {
    await registerAnaWithJose();
    const professionals = createProfessionalRepository(async () => database, protector);
    await professionals.insert({
      name: 'Bruno Lima',
      email: 'bruno@unieuro.com.br',
      crmNumber: '54321',
      crmState: 'GO',
      cpf: JOSE_CPF,
      passwordHash: 'hash',
      createdAt: '2026-09-26T13:00:00.000Z',
    });
    const [first, second] = await operations.listProfessionals();

    await operations.adoptAlias('profissional', {
      uuid_alias: first.uuid,
      uuid_principal: second.uuid,
    });

    await expect(operations.listAliases('profissional')).resolves.toEqual([]);
    expect((await operations.listProfessionals()).map((record) => record.uuid)).toEqual([
      first.uuid,
      second.uuid,
    ]);
  });

  it('um alias já conhecido não muda nada', async () => {
    const alias = { uuid_alias: OTHER, uuid_principal: '00000000-0000-4000-8000-000000000001' };
    await operations.adoptAlias('paciente', alias);

    await operations.adoptAlias('paciente', alias);

    await expect(operations.listAliases('paciente')).resolves.toEqual([alias]);
  });
});

describe('controle', () => {
  it('registra o tablet que mandou dados e diz se ele foi bloqueado', async () => {
    await operations.registerPeerDevice(OTHER, '2026-10-10T00:00:00.000Z');
    await expect(operations.isDeviceRevoked(OTHER)).resolves.toBe(false);

    await database.runAsync('UPDATE dispositivo SET revogado_em = ? WHERE id = ?', [
      '2026-10-11T00:00:00.000Z',
      OTHER,
    ]);

    await expect(operations.isDeviceRevoked(OTHER)).resolves.toBe(true);
  });

  it('o último recebimento é o mais recente que deu certo', async () => {
    await expect(operations.lastReceivedAt()).resolves.toBeNull();
    const entry = {
      direction: 'recebimento' as const,
      peerId: OTHER,
      startedAt: '2026-10-10T10:00:00.000Z',
    };

    await operations.writeLog({
      ...entry,
      finishedAt: '2026-10-10T10:00:01.000Z',
      result: 'sucesso',
    });
    await operations.writeLog({
      ...entry,
      finishedAt: '2026-10-10T11:00:00.000Z',
      result: 'recusado',
      reason: 'codigo_incorreto',
    });

    await expect(operations.lastReceivedAt()).resolves.toBe('2026-10-10T10:00:01.000Z');
  });
});

describe('transação', () => {
  it('desfaz tudo quando algo falha no meio', async () => {
    const repository = createSyncRepository(async () => database, protector);

    await expect(
      repository.inTransaction(async (txn) => {
        await txn.registerPeerDevice(OTHER, '2026-10-10T00:00:00.000Z');
        throw new Error('falha no meio');
      }),
    ).rejects.toThrow('falha no meio');

    await expect(operations.isDeviceRevoked(OTHER)).resolves.toBe(false);
    await expect(
      database.getFirstAsync('SELECT count(*) AS total FROM dispositivo'),
    ).resolves.toEqual({
      total: 1,
    });
  });

  it('devolve o resultado da tarefa quando dá certo', async () => {
    const repository = createSyncRepository(async () => database, protector);

    await expect(repository.inTransaction(async (txn) => txn.getLocalDeviceId())).resolves.toBe(
      await operations.getLocalDeviceId(),
    );
  });
});
