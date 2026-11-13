import type { SQLiteDatabase } from 'expo-sqlite';

import { createAttendanceRepository } from '@/db/attendance-repository';
import { bytesToBase64 } from '@/db/base64';
import { createConsentRepository } from '@/db/consent-repository';
import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { createDrawingRepository } from '@/db/drawing-repository';
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
const RESPONSIBLE_CPF = '39053344705';
const SIGNATURE = new Uint8Array([137, 80, 78, 71, 0, 255, 7]);
const DRAWING = new Uint8Array([137, 80, 78, 71, 9, 9]);
const OTHER_ATTENDANCE = '44444444-4444-4444-8444-444444444444';

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
  const { attendanceId } = await createAttendanceRepository(
    async () => database,
    protector,
  ).createAttendance({
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
  return attendanceId;
}

/** Aceite pelo responsável, um desenho com traçado e o estado final. */
async function finish(attendanceId: number, estado = 'concluida') {
  await createConsentRepository(async () => database, protector).salvarDecisao({
    atendimentoId: attendanceId,
    versaoTermo: 'tcle-2026-10',
    quemAssina: 'responsavel_legal',
    cpfResponsavel: RESPONSIBLE_CPF,
    aceito: true,
    assinaturaPng: SIGNATURE,
    autorizaImagensPesquisa: true,
    decididoEm: '2026-10-09T14:35:00.000Z',
  });
  await createDrawingRepository(async () => database).salvarDesenho({
    atendimentoId: attendanceId,
    ordem: 1,
    tipo: 'relogio',
    largura: 800,
    altura: 600,
    iniciadoEm: '2026-10-09T14:40:00.000Z',
    confirmadoEm: '2026-10-09T14:42:00.000Z',
    eventos: [
      { tipo: 'inicio', ordem: 1, instante: 0, x: 1.5, y: 2, ponteiro: 'caneta', pressao: 0.4 },
      { tipo: 'limpar', ordem: 2, instante: 30 },
    ],
    imagemPng: DRAWING,
  });
  await database.runAsync('UPDATE avaliacao SET estado = ? WHERE id = ?', [estado, attendanceId]);
}

describe('leitura para o pacote', () => {
  it('devolve os registros sem o id local e com o CPF decifrado', async () => {
    await finish(await registerAnaWithJose());

    const [professional] = await operations.listProfessionals();
    const [patient] = await operations.listPatients();
    const [attendance] = await operations.listAttendances();

    expect(professional).not.toHaveProperty('id');
    expect(professional).not.toHaveProperty('cpf_cifrado');
    expect(professional).toMatchObject({ cpf: ANA_CPF, origem_seq: 1 });
    expect(patient).toMatchObject({
      cpf: JOSE_CPF,
      numero_ficha: '2026-0001',
      origem_seq: 2,
      ativo: 1,
      exclusao: null,
    });
    expect(attendance).not.toHaveProperty('id');
    expect(attendance).toMatchObject({
      profissional_uuid: professional.uuid,
      paciente_uuid: patient.uuid,
      estado: 'concluida',
      ativo: 1,
      exclusao: null,
    });
  });

  it('a avaliação vai inteira, com os BLOBs em base64 e o CPF do responsável decifrado', async () => {
    await finish(await registerAnaWithJose());

    const [attendance] = await operations.listAttendances();

    expect(attendance.consentimento).toEqual({
      versao_tcle: 'tcle-2026-10',
      aceito: 1,
      assinado_por: 'responsavel_legal',
      assinatura_png: bytesToBase64(SIGNATURE),
      data_hora: '2026-10-09T14:35:00.000Z',
      autoriza_imagens_pesquisa: 1,
      autoriza_dados_pesquisa_futura: null,
      cpf_responsavel: RESPONSIBLE_CPF,
    });
    expect(attendance.tarefas).toEqual([
      {
        tipo: 'relogio',
        ordem: 1,
        largura: 800,
        altura: 600,
        data_hora_inicio: '2026-10-09T14:40:00.000Z',
        data_hora_termino: '2026-10-09T14:42:00.000Z',
        desenho: {
          imagem_final: bytesToBase64(DRAWING),
          data_hora_confirmacao: '2026-10-09T14:42:00.000Z',
        },
        eventos: [
          [1, 'inicio', 'caneta', 1.5, 2, 0, 0.4, null, null],
          [2, 'limpar', null, null, null, 30, null, null, null],
        ],
      },
    ]);
  });

  it.each(['aguardando_consentimento', 'em_andamento', 'processando_resultado', 'erro_inferencia'])(
    'não leva a avaliação %s, que ainda pode mudar',
    async (estado) => {
      const id = await registerAnaWithJose();
      await database.runAsync('UPDATE avaliacao SET estado = ? WHERE id = ?', [estado, id]);

      await expect(operations.listAttendances()).resolves.toEqual([]);
    },
  );
});

describe('gravação da avaliação recebida', () => {
  it('grava a avaliação e as tabelas ligadas a ela, e depois ela não muda mais', async () => {
    await finish(await registerAnaWithJose());
    const [attendance] = await operations.listAttendances();
    const [professional] = await operations.listProfessionals();
    const [patient] = await operations.listPatients();
    const copy = { ...attendance, uuid: OTHER_ATTENDANCE };

    await operations.insertAttendance(copy, 1, 1);

    const saved = (await operations.listAttendances()).find((row) => row.uuid === OTHER_ATTENDANCE);
    expect(saved).toEqual({
      ...copy,
      profissional_uuid: professional.uuid,
      paciente_uuid: patient.uuid,
    });
    await expect(
      database.getFirstAsync('SELECT recebimento_pendente FROM avaliacao WHERE uuid = ?', [
        OTHER_ATTENDANCE,
      ]),
    ).resolves.toEqual({ recebimento_pendente: 0 });
    await expect(
      database.runAsync("UPDATE avaliacao SET estado = 'interrompida' WHERE uuid = ?", [
        OTHER_ATTENDANCE,
      ]),
    ).rejects.toThrow(/avaliacao finalizada nao pode mudar/);
  });

  it('se uma parte falha, nada da avaliação fica gravado', async () => {
    await finish(await registerAnaWithJose());
    const [attendance] = await operations.listAttendances();
    const broken = {
      ...attendance,
      uuid: OTHER_ATTENDANCE,
      tarefas: [{ ...attendance.tarefas[0], largura: -1 }],
    };
    const repository = createSyncRepository(async () => database, protector);

    await expect(
      repository.inTransaction((txn) => txn.insertAttendance(broken, 1, 1)),
    ).rejects.toThrow(/CHECK/);

    const totals: Record<string, unknown> = {};
    for (const table of ['avaliacao', 'consentimento', 'tarefa', 'desenho', 'evento_tracado']) {
      totals[table] = (await database.getFirstAsync<{ total: number }>(
        `SELECT count(*) AS total FROM ${table}`,
      ))!.total;
    }
    expect(totals).toEqual({
      avaliacao: 1,
      consentimento: 1,
      tarefa: 1,
      desenho: 1,
      evento_tracado: 2,
    });
  });

  it('a exclusão recebida guarda a marca de quem excluiu', async () => {
    await finish(await registerAnaWithJose());
    const [attendance] = await operations.listAttendances();
    const stamp = {
      versao_hlc: `${'9'.repeat(15)}-000000-${OTHER}`,
      origem_id: OTHER,
      origem_seq: 4,
    };

    await operations.deleteAttendance(1, {
      ...attendance,
      ativo: 0,
      exclusao: '2026-11-11T09:00:00.000Z',
      ...stamp,
    });

    expect((await operations.listAttendances())[0]).toMatchObject({
      ativo: 0,
      exclusao: '2026-11-11T09:00:00.000Z',
      ...stamp,
    });
  });
});

describe('busca pelo CPF', () => {
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
