import type { SQLiteDatabase } from 'expo-sqlite';

import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { createProfessionalRepository } from '@/db/professional-repository';
import { SCHEMA_VERSION } from '@/db/schema';
import { createSyncRepository, type SyncRepository } from '@/db/sync-repository';
import {
  REFUSAL_MESSAGES,
  createSyncService,
  packageFileName,
} from '@/features/sincronizacao/sync-service';

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

    const everything = JSON.parse(await service().preparePackageFor({}, 'outro'));
    const nothing = JSON.parse(await service().preparePackageFor({ [deviceId]: 1 }, 'outro'));

    expect(everything.profissionais).toHaveLength(1);
    expect(nothing.profissionais).toEqual([]);
  });
});

describe('importação', () => {
  it('recusa o que não é pacote e registra a recusa', async () => {
    const result = await service().applyPackageJson('não é json');

    expect(result).toEqual({
      ok: false,
      reason: 'arquivo_invalido',
      message: REFUSAL_MESSAGES.arquivo_invalido,
    });
    await expect(
      database.getAllAsync('SELECT direcao, resultado, motivo FROM sync_log'),
    ).resolves.toEqual([
      { direcao: 'recebimento', resultado: 'recusado', motivo: 'arquivo_invalido' },
    ]);
  });

  it('um erro inesperado no banco desfaz tudo e vira a mensagem genérica', async () => {
    const pacote = await service().preparePackageFor({}, 'outro');
    const failing: SyncRepository = {
      ...repository,
      inTransaction: async () => {
        throw new Error('disco cheio');
      },
    };

    const result = await service({ repository: failing }).applyPackageJson(
      pacote.replace(/"origem":"[^"]+"/, '"origem":"bbbbbbbb-0000-4000-8000-000000000000"'),
    );

    expect(result).toEqual({ ok: false, reason: 'erro', message: REFUSAL_MESSAGES.erro });
    await expect(
      database.getFirstAsync("SELECT resultado FROM sync_log WHERE direcao = 'recebimento'"),
    ).resolves.toEqual({ resultado: 'erro' });
  });

  it('ainda não recebeu nada de outro tablet', async () => {
    await expect(service().lastReceivedAt()).resolves.toBeNull();
  });
});
