import type { SQLiteDatabase } from 'expo-sqlite';

import { createAttendanceRepository } from '@/db/attendance-repository';
import { getLocalDeviceId, observeRemoteHlc } from '@/db/change-tracking';
import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { formatHlc, parseHlc } from '@/db/hlc';
import { createProfessionalRepository } from '@/db/professional-repository';
import { MIGRATIONS, SCHEMA_VERSION } from '@/db/schema';
import { SCHEMA_V9 } from '@/db/sync-migration';

import { createTempDatabase, type TempDatabase } from '../../test-support/real-sqlite';
import { webCryptoAesGcm } from '../../test-support/web-crypto-aes-gcm';

// Migração 9 com SQLite real.

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

/** Profissional, paciente e avaliação aguardando o consentimento. Devolve o `id`. */
async function insertAttendance(): Promise<number> {
  await insertProfessional();
  const professional = await createProfessionalRepository(
    async () => database,
    protector,
  ).findByEmail('ana.souza@unieuro.com.br');
  const { attendanceId } = await createAttendanceRepository(
    async () => database,
    protector,
  ).createAttendance({
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
  return attendanceId;
}

const stampOf = (table: string, where = '1 = 1', params: (string | number)[] = []) =>
  database.getFirstAsync<{
    uuid: string;
    versao_hlc: string;
    origem_id: string;
    origem_seq: number;
  }>(`SELECT uuid, versao_hlc, origem_id, origem_seq FROM ${table} WHERE ${where}`, params);

describe('versão 9', () => {
  it('é o último passo da lista e cria as tabelas de controle', async () => {
    expect(MIGRATIONS[8]).toBe(SCHEMA_V9);
    expect(SCHEMA_VERSION).toBe(9);
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

  it.each(['paciente', 'avaliacao'])(
    'a tabela %s nasce ativa e a exclusão lógica gera marca',
    async (table) => {
      await insertAttendance();
      const before = await stampOf(table);
      await expect(database.getFirstAsync(`SELECT ativo, exclusao FROM ${table}`)).resolves.toEqual(
        { ativo: 1, exclusao: null },
      );

      await database.runAsync(`UPDATE ${table} SET ativo = 0, exclusao = ?`, [
        '2026-11-11T09:00:00.000Z',
      ]);

      expect((await stampOf(table))!.origem_seq).toBeGreaterThan(before!.origem_seq);
      await expect(database.runAsync(`UPDATE ${table} SET ativo = 2`)).rejects.toThrow(/CHECK/);
    },
  );
});

describe('avaliação finalizada', () => {
  const FINAL = /nao pode mudar/;

  async function finishedAttendance(estado = 'concluida') {
    const id = await insertAttendance();
    await database.runAsync(
      `INSERT INTO consentimento (id_avaliacao, versao_tcle, aceito, assinado_por, assinatura_png, data_hora)
       VALUES (?, 'tcle', 1, 'paciente', x'01', '2026-10-09T14:35:00.000Z')`,
      [id],
    );
    const { lastInsertRowId: taskId } = await database.runAsync(
      `INSERT INTO tarefa (id_avaliacao, tipo, ordem, largura, altura, data_hora_inicio)
       VALUES (?, 'relogio', 1, 800, 600, '2026-10-09T14:40:00.000Z')`,
      [id],
    );
    await database.runAsync(
      `INSERT INTO desenho (id_tarefa, imagem_final, data_hora_confirmacao)
       VALUES (?, x'02', '2026-10-09T14:42:00.000Z')`,
      [taskId],
    );
    await database.runAsync('UPDATE avaliacao SET estado = ? WHERE id = ?', [estado, id]);
    return { id, taskId };
  }

  it.each(['concluida', 'interrompida', 'cancelada'])(
    'a avaliação %s não muda de estado, de data, de profissional nem de paciente',
    async (estado) => {
      await finishedAttendance(estado);

      for (const change of [
        "estado = 'em_andamento'",
        "data_hora_inicio = '2026-01-01T00:00:00.000Z'",
        'id_profissional = id_profissional + 1',
        'id_paciente = id_paciente + 1',
      ]) {
        await expect(database.runAsync(`UPDATE avaliacao SET ${change}`)).rejects.toThrow(FINAL);
      }
    },
  );

  it('a avaliação finalizada ainda pode ser excluída logicamente, e regravar o mesmo valor passa', async () => {
    await finishedAttendance();

    await database.runAsync("UPDATE avaliacao SET estado = estado, ativo = 0, exclusao = 'x'");

    await expect(database.getFirstAsync('SELECT ativo FROM avaliacao')).resolves.toEqual({
      ativo: 0,
    });
  });

  it('nada ligado a ela muda: consentimento, tarefa, desenho e traçado', async () => {
    const { id, taskId } = await finishedAttendance();

    for (const sql of [
      "UPDATE consentimento SET versao_tcle = 'outra'",
      'DELETE FROM consentimento',
      `INSERT INTO tarefa (id_avaliacao, tipo, ordem, largura, altura, data_hora_inicio)
         VALUES (${id}, 'cubo', 2, 800, 600, 'x')`,
      'UPDATE tarefa SET largura = 1',
      'DELETE FROM desenho',
      "UPDATE desenho SET imagem_final = x'03'",
      `INSERT INTO evento_tracado (id_tarefa, ordem, tipo, instante) VALUES (${taskId}, 1, 'limpar', 0)`,
    ]) {
      await expect(database.execAsync(sql)).rejects.toThrow(FINAL);
    }
  });

  it('a avaliação em andamento continua recebendo desenhos e pode ser finalizada', async () => {
    const id = await insertAttendance();
    await database.runAsync("UPDATE avaliacao SET estado = 'em_andamento' WHERE id = ?", [id]);

    await database.runAsync(
      `INSERT INTO tarefa (id_avaliacao, tipo, ordem, largura, altura, data_hora_inicio)
       VALUES (?, 'relogio', 1, 800, 600, 'x')`,
      [id],
    );
    await database.runAsync("UPDATE avaliacao SET estado = 'concluida' WHERE id = ?", [id]);

    await expect(database.getFirstAsync('SELECT estado FROM avaliacao')).resolves.toEqual({
      estado: 'concluida',
    });
  });

  it('a recusa do TCLE grava o consentimento depois de cancelar a avaliação', async () => {
    const id = await insertAttendance();
    await database.runAsync("UPDATE avaliacao SET estado = 'cancelada' WHERE id = ?", [id]);

    await database.runAsync(
      `INSERT INTO consentimento (id_avaliacao, versao_tcle, aceito, assinado_por, data_hora)
       VALUES (?, 'tcle', 0, 'paciente', 'x')`,
      [id],
    );

    await expect(
      database.getFirstAsync('SELECT count(*) AS total FROM consentimento'),
    ).resolves.toEqual({ total: 1 });
  });

  it('enquanto o recebimento está pendente as tabelas ligadas entram, e depois não reabre', async () => {
    const { id } = await finishedAttendance();
    await expect(
      database.runAsync('UPDATE avaliacao SET recebimento_pendente = 1 WHERE id = ?', [id]),
    ).rejects.toThrow(FINAL);

    // Como a sincronização grava: a avaliação já finalizada, com o recebimento pendente.
    const { lastInsertRowId: other } = await database.runAsync(
      `INSERT INTO avaliacao (id_profissional, id_paciente, data_hora_inicio, estado, last_update,
         recebimento_pendente)
       SELECT id_profissional, id_paciente, 'x', 'concluida', 'x', 1 FROM avaliacao WHERE id = ?`,
      [id],
    );
    await database.runAsync(
      `INSERT INTO tarefa (id_avaliacao, tipo, ordem, largura, altura, data_hora_inicio)
       VALUES (?, 'relogio', 1, 800, 600, 'x')`,
      [other],
    );
    await database.runAsync('UPDATE avaliacao SET recebimento_pendente = 0 WHERE id = ?', [other]);

    await expect(
      database.runAsync('UPDATE tarefa SET largura = 1 WHERE id_avaliacao = ?', [other]),
    ).rejects.toThrow(FINAL);
  });
});

describe('banco que já existia', () => {
  it('marca os registros antigos como deste tablet, e o contador continua depois deles', async () => {
    // Banco na versão 8, como nos tablets hoje.
    const legacyTemp = createTempDatabase();
    const legacy = legacyTemp.open();
    await legacy.execAsync('PRAGMA foreign_keys = ON;');
    for (const step of MIGRATIONS.slice(0, 8)) {
      if (typeof step === 'function') await step(legacy, protector);
      else await legacy.execAsync(step);
    }
    await legacy.execAsync('PRAGMA user_version = 8');
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
