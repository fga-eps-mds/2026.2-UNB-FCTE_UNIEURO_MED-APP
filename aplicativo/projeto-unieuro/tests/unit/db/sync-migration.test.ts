import type { SQLiteDatabase } from 'expo-sqlite';

import { createAttendanceRepository } from '@/db/attendance-repository';
import { getLocalDeviceId, observeRemoteHlc } from '@/db/change-tracking';
import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { formatHlc, parseHlc } from '@/db/hlc';
import { createProfessionalRepository } from '@/db/professional-repository';
import { MIGRATIONS, SCHEMA_VERSION } from '@/db/schema';
import { SCHEMA_V4 } from '@/db/sync-migration';

import { createTempDatabase, type TempDatabase } from '../../test-support/real-sqlite';
import { webCryptoAesGcm } from '../../test-support/web-crypto-aes-gcm';

// Migração 4 com SQLite real.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const protector = createCpfProtector(async () => new Uint8Array(32).fill(3), webCryptoAesGcm);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let temp: TempDatabase;
let database: SQLiteDatabase;

beforeEach(async () => {
  temp = createTempDatabase();
  database = temp.open();
  await migrate(database, protector);
});

afterEach(async () => {
  await database.closeAsync();
  temp.cleanup();
});

async function insertProfessional(email = 'ana.souza@unieuro.com.br', crm = '12345') {
  await createProfessionalRepository(async () => database, protector).insert({
    name: 'Ana Carolina Souza',
    email,
    crmNumber: crm,
    crmState: 'DF',
    cpf: crm === '12345' ? '11144477735' : '52998224725',
    passwordHash: 'hash',
    createdAt: '2026-09-26T13:00:00.000Z',
  });
}

const stampOf = (table: string, where = '1 = 1', params: (string | number)[] = []) =>
  database.getFirstAsync<{
    uuid: string;
    versao_hlc: string;
    origem_id: string;
    origem_seq: number;
  }>(`SELECT uuid, versao_hlc, origem_id, origem_seq FROM ${table} WHERE ${where}`, params);

describe('versão 4', () => {
  it('é o último passo da lista e cria as tabelas de controle', async () => {
    expect(MIGRATIONS[3]).toBe(SCHEMA_V4);
    expect(SCHEMA_VERSION).toBe(4);
    const tables = await database.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        'dispositivo',
        'sync_contador',
        'sync_vetor',
        'sync_log',
        'sync_conflito',
        'profissional_alias',
        'paciente_alias',
      ]),
    );
  });

  it('dá a este tablet uma identificação própria, com o contador zerado', async () => {
    const deviceId = await getLocalDeviceId(database);

    expect(deviceId).toMatch(UUID);
    await expect(
      database.getFirstAsync('SELECT ultimo_seq, ultimo_hlc FROM sync_contador'),
    ).resolves.toEqual({ ultimo_seq: 0, ultimo_hlc: '' });
  });

  it('cada tablet novo tem uma identificação diferente', async () => {
    const other = createTempDatabase();
    const otherDatabase = other.open();
    await migrate(otherDatabase, protector);

    expect(await getLocalDeviceId(otherDatabase)).not.toBe(await getLocalDeviceId(database));
    await otherDatabase.closeAsync();
    other.cleanup();
  });

  it('aplicar de novo não muda nada', async () => {
    const before = await getLocalDeviceId(database);

    await migrate(database, protector);

    expect(await getLocalDeviceId(database)).toBe(before);
  });
});

describe('marca de cada gravação local', () => {
  it('o cadastro recebe uuid, HLC e o contador deste tablet, sem o repositório saber', async () => {
    await insertProfessional();

    const stamp = await stampOf('profissional');
    const deviceId = await getLocalDeviceId(database);
    expect(stamp).toMatchObject({ origem_id: deviceId, origem_seq: 1 });
    expect(stamp!.uuid).toMatch(UUID);
    expect(parseHlc(stamp!.versao_hlc)).toEqual({
      millis: expect.any(Number),
      counter: expect.any(Number),
      node: deviceId,
    });
  });

  it('o contador é um só para profissional, paciente e atendimento', async () => {
    await insertProfessional();
    const professional = await createProfessionalRepository(
      async () => database,
      protector,
    ).findByEmail('ana.souza@unieuro.com.br');
    await createAttendanceRepository(async () => database, protector).createAttendance({
      patient: {
        name: 'José Alves Martins',
        cpf: '52998224725',
        birthDate: '1948-03-14',
        schoolingYears: 5,
        sex: null,
      },
      professionalId: professional!.id,
      startedAt: '2026-10-09T14:32:00.000Z',
    });

    expect((await stampOf('profissional'))!.origem_seq).toBe(1);
    expect((await stampOf('paciente'))!.origem_seq).toBe(2);
    expect((await stampOf('avaliacao'))!.origem_seq).toBe(3);
  });

  it('uma edição dos dados que viajam gera uma marca nova, sempre depois da anterior', async () => {
    await insertProfessional();
    const before = await stampOf('profissional');

    await database.runAsync("UPDATE profissional SET nome = 'Ana Souza'");

    const after = await stampOf('profissional');
    expect(after!.uuid).toBe(before!.uuid);
    expect(after!.origem_seq).toBe(2);
    expect(after!.versao_hlc > before!.versao_hlc).toBe(true);
  });

  it('mesmo com o relógio do tablet atrasado, a marca nova vem depois da anterior', async () => {
    await insertProfessional();
    const deviceId = await getLocalDeviceId(database);
    // HLC de um tablet com o relógio um dia adiantado.
    const future = formatHlc({ millis: Date.now() + 86_400_000, counter: 4, node: deviceId });
    await observeRemoteHlc(database, future);

    await database.runAsync("UPDATE profissional SET nome = 'Ana Souza'");

    const after = await stampOf('profissional');
    expect(after!.versao_hlc > future).toBe(true);
  });

  it('a ficha e o CPF protegido são deste tablet e não geram marca', async () => {
    await insertProfessional();
    const professional = await createProfessionalRepository(
      async () => database,
      protector,
    ).findByEmail('ana.souza@unieuro.com.br');
    await createAttendanceRepository(async () => database, protector).createAttendance({
      patient: {
        name: 'José Alves Martins',
        cpf: '52998224725',
        birthDate: '1948-03-14',
        schoolingYears: 5,
        sex: null,
      },
      professionalId: professional!.id,
      startedAt: '2026-10-09T14:32:00.000Z',
    });
    const before = await stampOf('paciente');

    await database.runAsync("UPDATE paciente SET numero_ficha = '2026-0099'");
    await database.runAsync('UPDATE profissional SET cpf_indice = cpf_indice');

    expect(await stampOf('paciente')).toEqual(before);
    expect((await stampOf('profissional'))!.origem_seq).toBe(1);
  });

  it('a gravação que já traz a marca de outro tablet fica com ela', async () => {
    await insertProfessional();
    const other = 'bbbbbbbb-0000-4000-8000-000000000000';
    const hlc = formatHlc({ millis: 1, counter: 0, node: other });

    await database.runAsync(
      "UPDATE profissional SET nome = 'Vinda de fora', versao_hlc = ?, origem_id = ?, origem_seq = 9",
      [hlc, other],
    );

    expect(await stampOf('profissional')).toMatchObject({
      versao_hlc: hlc,
      origem_id: other,
      origem_seq: 9,
    });
  });
});

describe('exclusão', () => {
  it.each(['profissional', 'paciente', 'avaliacao'])(
    'não deixa apagar da tabela %s, para a exclusão não sumir da sincronização',
    async (table) => {
      await insertProfessional();
      const professional = await createProfessionalRepository(
        async () => database,
        protector,
      ).findByEmail('ana.souza@unieuro.com.br');
      await createAttendanceRepository(async () => database, protector).createAttendance({
        patient: {
          name: 'José Alves Martins',
          cpf: '52998224725',
          birthDate: '1948-03-14',
          schoolingYears: 5,
          sex: null,
        },
        professionalId: professional!.id,
        startedAt: '2026-10-09T14:32:00.000Z',
      });

      await expect(database.execAsync(`DELETE FROM ${table}`)).rejects.toThrow(
        /nao pode ser apagado/,
      );
      await expect(
        database.getFirstAsync(`SELECT count(*) AS total FROM ${table}`),
      ).resolves.toEqual({ total: 1 });
    },
  );

  it('a desativação do profissional é uma alteração comum, que gera marca', async () => {
    await insertProfessional();

    await database.runAsync('UPDATE profissional SET ativo = 0');

    expect((await stampOf('profissional'))!.origem_seq).toBe(2);
  });
});

describe('banco que já existia', () => {
  it('marca os registros antigos como deste tablet, e o contador continua depois deles', async () => {
    // Banco na versão 3, como nos tablets hoje.
    const legacyTemp = createTempDatabase();
    const legacy = legacyTemp.open();
    const [schemaV1, protectCpfs, schemaV3] = MIGRATIONS;
    await legacy.execAsync('PRAGMA foreign_keys = ON;');
    await legacy.execAsync(schemaV1 as string);
    if (typeof protectCpfs === 'function') await protectCpfs(legacy, protector);
    await legacy.execAsync(schemaV3 as string);
    await legacy.execAsync('PRAGMA user_version = 3');
    for (const [email, crm] of [
      ['ana@unieuro.com.br', '111'],
      ['bruno@unieuro.com.br', '222'],
    ]) {
      await legacy.runAsync(
        `INSERT INTO profissional (nome, email, crm_numero, uf_crm, cpf_cifrado, cpf_indice, senha_hash, criacao, last_update)
         VALUES ('Profissional', ?, ?, 'DF', 'cifra', ?, 'hash', '2026-09-28T10:00:00.000Z', '2026-09-28T10:00:00.000Z')`,
        [email, crm, crm.padEnd(64, '0')],
      );
    }

    await migrate(legacy, protector);

    const rows = await legacy.getAllAsync<{ uuid: string; origem_seq: number; versao_hlc: string }>(
      'SELECT uuid, origem_seq, versao_hlc FROM profissional ORDER BY id',
    );
    const deviceId = await getLocalDeviceId(legacy);
    expect(rows.map((row) => row.origem_seq)).toEqual([1, 2]);
    expect(new Set(rows.map((row) => row.uuid)).size).toBe(2);
    expect(parseHlc(rows[0].versao_hlc)).toEqual({
      millis: Date.parse('2026-09-28T10:00:00.000Z'),
      counter: 0,
      node: deviceId,
    });
    await expect(legacy.getFirstAsync('SELECT ultimo_seq FROM sync_contador')).resolves.toEqual({
      ultimo_seq: 2,
    });

    await legacy.runAsync(
      `INSERT INTO profissional (nome, email, crm_numero, uf_crm, cpf_cifrado, cpf_indice, senha_hash, criacao, last_update)
       VALUES ('Carla', 'carla@unieuro.com.br', '333', 'DF', 'cifra', ?, 'hash', 'x', 'x')`,
      ['3'.padEnd(64, '0')],
    );
    await expect(
      legacy.getFirstAsync("SELECT origem_seq FROM profissional WHERE crm_numero = '333'"),
    ).resolves.toEqual({ origem_seq: 3 });
    await legacy.closeAsync();
    legacyTemp.cleanup();
  });
});
