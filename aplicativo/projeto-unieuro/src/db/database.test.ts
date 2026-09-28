import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { closeDatabase, getDatabase, migrate } from '@/db/database';
import { DATABASE_NAME, MIGRATIONS, SCHEMA_VERSION } from '@/db/schema';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

const mockOpenDatabaseAsync = jest.mocked(openDatabaseAsync);

function createDatabase(userVersion: number | null = 0) {
  const database = {
    execAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(async () => (userVersion === null ? null : { user_version: userVersion })),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
    closeAsync: jest.fn(async () => undefined),
  };
  return database as typeof database & SQLiteDatabase;
}

afterEach(async () => {
  await closeDatabase();
});

describe('migrate', () => {
  it('ativa o WAL e as chaves estrangeiras antes de tudo', async () => {
    const database = createDatabase();

    await migrate(database);

    expect(database.execAsync).toHaveBeenNthCalledWith(
      1,
      'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;',
    );
  });

  it.each([
    ['vazio', 0],
    ['sem versão registrada', null],
  ])('cria o esquema em uma transação quando o banco está %s', async (_case, userVersion) => {
    const database = createDatabase(userVersion);

    await migrate(database);

    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    MIGRATIONS.forEach((step) => expect(database.execAsync).toHaveBeenCalledWith(step));
    expect(database.execAsync).toHaveBeenLastCalledWith(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });

  it('não executa nada quando o banco já está na versão atual', async () => {
    const database = createDatabase(SCHEMA_VERSION);

    await migrate(database);

    expect(database.withTransactionAsync).not.toHaveBeenCalled();
    expect(database.execAsync).toHaveBeenCalledTimes(1);
  });
});

describe('esquema', () => {
  it('cria a tabela profissional com as restrições do MED-IA', () => {
    const [schemaV1] = MIGRATIONS;

    expect(schemaV1).toContain('CREATE TABLE IF NOT EXISTS profissional');
    expect(schemaV1).toContain('email TEXT NOT NULL COLLATE NOCASE UNIQUE');
    expect(schemaV1).toContain('UNIQUE (crm_numero, uf_crm)');
    expect(SCHEMA_VERSION).toBe(1);
  });
});

describe('getDatabase', () => {
  it('abre o banco uma única vez e reaproveita a conexão', async () => {
    const database = createDatabase();
    mockOpenDatabaseAsync.mockResolvedValue(database);

    const [first, second] = await Promise.all([getDatabase(), getDatabase()]);

    expect(first).toBe(database);
    expect(second).toBe(database);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledWith(DATABASE_NAME);
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('tenta abrir de novo depois de uma falha', async () => {
    const database = createDatabase();
    mockOpenDatabaseAsync
      .mockRejectedValueOnce(new Error('falha ao abrir'))
      .mockResolvedValueOnce(database);

    await expect(getDatabase()).rejects.toThrow('falha ao abrir');
    await expect(getDatabase()).resolves.toBe(database);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2);
  });
});

describe('closeDatabase', () => {
  it('fecha a conexão aberta e permite abrir outra', async () => {
    const database = createDatabase();
    mockOpenDatabaseAsync.mockResolvedValue(database);
    await getDatabase();

    await closeDatabase();
    await getDatabase();

    expect(database.closeAsync).toHaveBeenCalledTimes(1);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it('não faz nada quando não há conexão', async () => {
    await expect(closeDatabase()).resolves.toBeUndefined();
  });

  it('ignora uma abertura que falhou', async () => {
    mockOpenDatabaseAsync.mockRejectedValueOnce(new Error('falha ao abrir'));
    const pending = getDatabase();

    await closeDatabase();

    await expect(pending).rejects.toThrow('falha ao abrir');
  });
});
