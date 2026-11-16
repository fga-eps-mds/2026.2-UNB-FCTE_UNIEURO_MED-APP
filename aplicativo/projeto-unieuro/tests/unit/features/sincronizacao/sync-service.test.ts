import type { SQLiteDatabase } from 'expo-sqlite';

import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { createProfessionalRepository } from '@/db/professional-repository';
import { SCHEMA_VERSION } from '@/db/schema';
import { createSyncRepository, type SyncRepository } from '@/db/sync-repository';
import { syncFailure } from '@/features/sincronizacao/error-codes';
import { createSyncService, packageFileName } from '@/features/sincronizacao/sync-service';

import { createTempDatabase, type TempDatabase } from '../../../test-support/real-sqlite';
import { webCryptoAesGcm } from '../../../test-support/web-crypto-aes-gcm';

// SQLite real. A troca entre dois tablets está em tests/integration.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual('node:crypto');
  return {
    getRandomBytesAsync: async (size: number) => new Uint8Array(crypto.randomBytes(size)),
  };
});

const protector = createCpfProtector(async () => new Uint8Array(32).fill(9), webCryptoAesGcm);
const NOW = new Date(2026, 9, 5, 9, 7);
const OTHER = 'eeeeeeee-0000-4000-8000-000000000000';
const PEER = 'bbbbbbbb-0000-4000-8000-000000000000';
const OTHER_ORIGIN = 'ffffffff-0000-4000-8000-000000000000';

const insertBruno = () =>
  createProfessionalRepository(async () => database, protector).insert({
    name: 'Bruno Lima',
    email: 'bruno.lima@unieuro.com.br',
    crmNumber: '22222',
    crmState: 'DF',
    cpf: '22233344405',
    passwordHash: 'hash',
    createdAt: '2026-09-26T14:00:00.000Z',
  });

let temp: TempDatabase;
let database: SQLiteDatabase;
let repository: SyncRepository;

beforeEach(async () => {
  temp = createTempDatabase();
  database = temp.open();
  await migrate(database, protector);
  repository = createSyncRepository(async () => database, protector);
  await createProfessionalRepository(async () => database, protector).insert({
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crmNumber: '12345',
    crmState: 'DF',
    cpf: '11144477735',
    passwordHash: 'hash',
    createdAt: '2026-09-26T13:00:00.000Z',
  });
});

afterEach(async () => {
  await database.closeAsync();
  temp.cleanup();
});

const service = (dependencies: Partial<Parameters<typeof createSyncService>[0]> = {}) =>
  createSyncService({ repository, now: () => NOW, ...dependencies });

describe('packageFileName', () => {
  it('leva só a data e a hora, sem dado de profissional ou paciente', () => {
    expect(packageFileName(NOW)).toBe('med-sincronizacao-20261005-0907.medsync');
  });
});

describe('exportPackage', () => {
  it('cifra o pacote com um código novo e registra o envio no histórico', async () => {
    const result = await service().exportPackage();

    expect(result).toMatchObject({
      code: expect.stringMatching(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/),
      fileName: 'med-sincronizacao-20261005-0907.medsync',
      sent: 1,
    });
    expect(result.contents).toContain('med-sync-cifrado');
    expect(result.contents).not.toContain('Ana Carolina Souza');
    await expect(
      database.getAllAsync('SELECT direcao, enviados, resultado FROM sync_log'),
    ).resolves.toEqual([{ direcao: 'envio', enviados: 1, resultado: 'sucesso' }]);
  });
});

describe('troca direta', () => {
  it('descreve este tablet com a versão do banco e o vetor', async () => {
    const local = await service().describeLocal();

    expect(local).toEqual({
      deviceId: expect.any(String),
      schemaVersion: SCHEMA_VERSION,
      vector: { [local.deviceId]: 1 },
    });
  });

  it('prepara só o que o outro tablet ainda não tem', async () => {
    const { deviceId } = await service().describeLocal();

    const everything = await service().prepareBatchesFor({}, OTHER);
    const nothing = await service().prepareBatchesFor({ [deviceId]: 1 }, OTHER);

    expect(everything.total).toBe(1);
    expect(JSON.parse((await everything.read(0)).pacote).profissionais).toHaveLength(1);
    expect(nothing.total).toBe(1);
    expect(JSON.parse((await nothing.read(0)).pacote).profissionais).toEqual([]);
  });

  it('divide em lotes pelo tamanho e dá a cada lote a cobertura que ele garante', async () => {
    await insertBruno();
    const { deviceId } = await service().describeLocal();

    const batches = await service({ batchMaxBytes: 100 }).prepareBatchesFor({}, OTHER);

    expect(batches.total).toBe(2);
    const first = await batches.read(0);
    const second = await batches.read(1);
    expect(JSON.parse(first.pacote).profissionais).toHaveLength(1);
    expect(first.cobertura).toEqual({ [deviceId]: 1 });
    expect(JSON.parse(second.pacote).profissionais).toHaveLength(1);
    expect(second.cobertura).toEqual({ [deviceId]: 2 });
  });

  it.each([
    [2, 'sucesso', 2],
    [1, 'parcial', 1],
    [0, 'erro', 0],
  ])(
    'com %i lotes confirmados, registra o envio como %s',
    async (confirmed, resultado, enviados) => {
      await insertBruno();
      const batches = await service({ batchMaxBytes: 100 }).prepareBatchesFor({}, OTHER);

      await batches.finish(confirmed);

      await expect(
        database.getAllAsync('SELECT direcao, par_id, enviados, resultado FROM sync_log'),
      ).resolves.toEqual([{ direcao: 'envio', par_id: OTHER, enviados, resultado }]);
    },
  );
});

describe('recebimento em lotes', () => {
  // Um lote de outro tablet, com o profissional deste trocado por um novo.
  async function batchFrom(origin: string, uuid = 'cccccccc-0000-4000-8000-000000000000') {
    const { pacote } = await (await service().prepareBatchesFor({}, OTHER)).read(0);
    const value = JSON.parse(pacote);
    const professional = {
      ...value.profissionais[0],
      uuid,
      email: `${uuid.slice(0, 4)}@unieuro.com.br`,
      crm_numero: uuid.slice(0, 1) === 'c' ? '99999' : '88888',
      cpf: uuid.slice(0, 1) === 'c' ? '52998224725' : '22233344405',
      origem_id: origin,
      origem_seq: 1,
    };
    return JSON.stringify({
      ...value,
      origem: origin,
      vetor: { [origin]: 1 },
      profissionais: [professional],
    });
  }

  it('recusa o que não é pacote e registra a recusa', async () => {
    const result = await service().receiveBatches().apply('não é json', {});

    // Pelo Nearby, o pacote ilegível é o código 304.
    expect(result).toEqual({
      ok: false,
      reason: 'arquivo_invalido',
      failure: syncFailure(304),
    });
    await expect(
      database.getAllAsync('SELECT direcao, resultado, motivo FROM sync_log'),
    ).resolves.toEqual([{ direcao: 'recebimento', resultado: 'recusado', motivo: '304' }]);
  });

  it('um erro inesperado no banco desfaz o lote e vira o código 313', async () => {
    const failing: SyncRepository = {
      ...repository,
      inTransaction: async () => {
        throw new Error('disco cheio');
      },
    };

    const result = await service({ repository: failing })
      .receiveBatches()
      .apply(await batchFrom(PEER), {});

    expect(result).toEqual({ ok: false, reason: 'erro', failure: syncFailure(313) });
    await expect(
      database.getFirstAsync(
        "SELECT resultado, motivo FROM sync_log WHERE direcao = 'recebimento'",
      ),
    ).resolves.toEqual({ resultado: 'erro', motivo: '313' });
  });

  it('o vetor avança só até a cobertura do lote', async () => {
    const receiver = service().receiveBatches();

    const result = await receiver.apply(await batchFrom(PEER), { [PEER]: 0 });
    await receiver.finish(false, 340);

    expect(result).toMatchObject({ ok: true, summary: { professionals: { inserted: 1 } } });
    expect(receiver.applied()).toBe(1);
    await expect(
      database.getAllAsync('SELECT origem_id FROM sync_vetor WHERE ultimo_seq_recebido > 0'),
    ).resolves.toEqual([]);
    await expect(
      database.getAllAsync("SELECT resultado, motivo FROM sync_log WHERE direcao = 'recebimento'"),
    ).resolves.toEqual([{ resultado: 'parcial', motivo: '340' }]);
  });

  it('a cobertura não passa do vetor de quem enviou', async () => {
    const receiver = service().receiveBatches();

    await receiver.apply(await batchFrom(PEER), { [PEER]: 50, [OTHER_ORIGIN]: 7 });
    await receiver.finish(true);

    await expect(
      database.getAllAsync('SELECT origem_id, ultimo_seq_recebido FROM sync_vetor'),
    ).resolves.toEqual([{ origem_id: PEER, ultimo_seq_recebido: 1 }]);
  });

  it('soma os lotes e registra um só recebimento por troca', async () => {
    const receiver = service().receiveBatches();

    await receiver.apply(await batchFrom(PEER), {});
    await receiver.apply(await batchFrom(PEER, 'dddddddd-0000-4000-8000-000000000000'), {});
    await receiver.finish(true);
    await receiver.finish(true);

    expect(receiver.summary()).toMatchObject({ professionals: { inserted: 2 } });
    await expect(
      database.getAllAsync(
        "SELECT recebidos, resultado FROM sync_log WHERE direcao = 'recebimento'",
      ),
    ).resolves.toEqual([{ recebidos: 2, resultado: 'sucesso' }]);
  });

  it('recusa um lote de outro tablet no meio da troca e para de aceitar lotes', async () => {
    const receiver = service().receiveBatches();
    await receiver.apply(await batchFrom(PEER), {});

    const intruder = await receiver.apply(await batchFrom(OTHER_ORIGIN), {});
    const after = await receiver.apply(await batchFrom(PEER), {});
    await receiver.finish(true);

    expect(intruder).toEqual({
      ok: false,
      reason: 'origem_trocada',
      failure: syncFailure(312, { kept: true }),
    });
    expect(after).toEqual({
      ok: false,
      reason: 'erro',
      failure: syncFailure(313, { kept: true }),
    });
    await expect(
      database.getAllAsync("SELECT resultado, motivo FROM sync_log WHERE direcao = 'recebimento'"),
    ).resolves.toEqual([{ resultado: 'parcial', motivo: '312' }]);
  });

  it('sem nenhum lote gravado, não registra nada ao terminar', async () => {
    await service().receiveBatches().finish(false);

    await expect(database.getAllAsync('SELECT * FROM sync_log')).resolves.toEqual([]);
  });
});

describe('importação do arquivo', () => {
  it('grava lote por lote; se um falha, avisa que entrou só parte, e importar de novo completa', async () => {
    await insertBruno();
    const exported = await service().exportPackage();
    const other = createTempDatabase();
    const otherDatabase = other.open();
    await migrate(otherDatabase, protector);
    const otherRepository = createSyncRepository(async () => otherDatabase, protector);
    let transactions = 0;
    const failingSecond: SyncRepository = {
      ...otherRepository,
      inTransaction: (task) => {
        transactions += 1;
        if (transactions === 2) throw new Error('memória cheia');
        return otherRepository.inTransaction(task);
      },
    };

    const partial = await createSyncService({
      repository: failingSecond,
      batchMaxBytes: 100,
    }).importPackage(exported.contents, exported.code);
    const count = async () =>
      (await otherDatabase.getAllAsync('SELECT uuid FROM profissional')).length;

    expect(partial).toEqual({ ok: false, reason: 'erro', failure: syncFailure(418) });
    expect(await count()).toBe(1);

    const again = await createSyncService({
      repository: otherRepository,
      batchMaxBytes: 100,
    }).importPackage(exported.contents, exported.code);

    expect(again).toMatchObject({
      ok: true,
      summary: { professionals: { inserted: 1 }, skipped: 1 },
    });
    expect(await count()).toBe(2);
    // O histórico guarda o código da causa: 417, erro ao gravar.
    await expect(
      otherDatabase.getAllAsync(
        "SELECT resultado, motivo FROM sync_log WHERE direcao = 'recebimento'",
      ),
    ).resolves.toEqual([
      { resultado: 'parcial', motivo: '417' },
      { resultado: 'sucesso', motivo: null },
    ]);
    await otherDatabase.closeAsync();
    other.cleanup();
  });

  it('com o código errado, não grava nada', async () => {
    const exported = await service().exportPackage();

    const result = await service().importPackage(exported.contents, 'AAAA-AAAA-AAAA');

    expect(result).toMatchObject({ ok: false, reason: 'codigo_incorreto' });
  });
  it('ainda não recebeu nada de outro tablet', async () => {
    await expect(service().lastReceivedAt()).resolves.toBeNull();
  });
});
