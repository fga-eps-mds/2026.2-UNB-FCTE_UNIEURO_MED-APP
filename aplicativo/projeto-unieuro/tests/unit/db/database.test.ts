import { File } from 'expo-file-system';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { protectStoredCpfs } from '@/db/cpf-migration';
import type { CpfProtector } from '@/db/cpf-protection';
import { closeDatabase, getDatabase, LEGACY_DATABASE_MESSAGE, migrate } from '@/db/database';
import { applyDatabaseEncryption } from '@/db/database-encryption';
import { loadOrCreateDatabaseKey } from '@/db/database-key';
import { DATABASE_NAME, MIGRATIONS, SCHEMA_VERSION } from '@/db/schema';

jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/sqlite',
  openDatabaseAsync: jest.fn(),
}));

const mockFile = { exists: false, size: 0, open: jest.fn() };
jest.mock('expo-file-system', () => ({ File: jest.fn(() => mockFile) }));

// A conversão do CPF tem teste próprio em `cpf-migration.test.ts`. Aqui só
// importa que `migrate` a execute no passo certo.
jest.mock('@/db/cpf-migration', () => ({
  protectStoredCpfs: jest.fn(async () => undefined),
}));

// O módulo de runtime usa o cofre seguro e a cifra nativa, que só existem no
// aplicativo. Nestes testes o protetor é sempre passado de fora.
jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

jest.mock('@/db/database-encryption', () => ({
  applyDatabaseEncryption: jest.fn(async () => undefined),
}));

jest.mock('@/db/database-key', () => ({
  loadOrCreateDatabaseKey: jest.fn(async () => new Uint8Array(32)),
}));

const protector: CpfProtector = {
  blindIndex: jest.fn(),
  encrypt: jest.fn(),
  decrypt: jest.fn(),
};

const mockOpenDatabaseAsync = jest.mocked(openDatabaseAsync);
const mockApplyDatabaseEncryption = jest.mocked(applyDatabaseEncryption);
const mockLoadOrCreateDatabaseKey = jest.mocked(loadOrCreateDatabaseKey);

/** Executa a função de chave que `getDatabase` entregou a `applyDatabaseEncryption`. */
async function loadKeyPassedToEncryption() {
  const loadKey = mockApplyDatabaseEncryption.mock.calls[0]?.[1];
  expect(loadKey).toBeDefined();
  await loadKey!();
}

function createDatabase(userVersion: number | null = 0) {
  const database = {
    execAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(async () =>
      userVersion === null ? null : { user_version: userVersion },
    ),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
    closeAsync: jest.fn(async () => undefined),
  };
  return database as typeof database & SQLiteDatabase;
}

afterEach(async () => {
  await closeDatabase();
  mockFile.exists = false;
  mockFile.size = 0;
});

describe('migrate', () => {
  it('ativa o WAL e as chaves estrangeiras antes de tudo', async () => {
    const database = createDatabase();

    await migrate(database, protector);

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

    await migrate(database, protector);

    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.execAsync).toHaveBeenCalledWith(MIGRATIONS[0]);
    expect(protectStoredCpfs).toHaveBeenCalledWith(database, protector);
    expect(database.execAsync).toHaveBeenLastCalledWith(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });

  it('só protege o CPF, sem recriar o esquema, quando o banco está na versão 1', async () => {
    const database = createDatabase(1);

    await migrate(database, protector);

    expect(database.execAsync).not.toHaveBeenCalledWith(MIGRATIONS[0]);
    expect(protectStoredCpfs).toHaveBeenCalledWith(database, protector);
    expect(database.execAsync).toHaveBeenCalledWith(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });

  it('refaz o arquivo e esvazia o WAL, fora da transação, depois de reescrever dados antigos', async () => {
    const database = createDatabase(1);

    await migrate(database, protector);

    const vacuum = 'VACUUM; PRAGMA wal_checkpoint(TRUNCATE);';
    expect(database.execAsync).toHaveBeenLastCalledWith(vacuum);
    const vacuumOrder = database.execAsync.mock.invocationCallOrder.at(-1)!;
    const transactionOrder = database.withTransactionAsync.mock.invocationCallOrder[0];
    expect(vacuumOrder).toBeGreaterThan(transactionOrder);
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('não refaz o arquivo num banco novo, que não tem dado antigo a apagar', async () => {
    const database = createDatabase(0);

    await migrate(database, protector);

    expect(database.execAsync).not.toHaveBeenCalledWith('VACUUM; PRAGMA wal_checkpoint(TRUNCATE);');
    expect(database.execAsync).toHaveBeenLastCalledWith(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });

  it('não executa nada quando o banco já está na versão atual', async () => {
    const database = createDatabase(SCHEMA_VERSION);

    await migrate(database, protector);

    expect(protectStoredCpfs).not.toHaveBeenCalled();
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
  });

  it('chega à versão 2 com o passo que protege o CPF', () => {
    expect(MIGRATIONS[1]).toBe(protectStoredCpfs);
  });

  it('chega à versão 3 com o paciente e o atendimento da #7', () => {
    const schemaV3 = MIGRATIONS[2];

    expect(schemaV3).toContain('CREATE TABLE IF NOT EXISTS paciente');
    expect(schemaV3).toContain('cpf_indice TEXT NOT NULL UNIQUE');
    expect(schemaV3).toContain('CREATE TABLE IF NOT EXISTS avaliacao');
    expect(schemaV3).toContain('REFERENCES profissional (id)');
  });

  it('chega à versão 4 com a data da desativação da conta da #5', () => {
    expect(MIGRATIONS[3]).toContain('ALTER TABLE profissional ADD COLUMN desativacao TEXT');
  });

  it('chega à versão 5 com um único consentimento por avaliação', () => {
    expect(MIGRATIONS[4]).toContain('CREATE TABLE IF NOT EXISTS consentimento');
    expect(MIGRATIONS[4]).toContain('id_avaliacao INTEGER NOT NULL UNIQUE');
    expect(MIGRATIONS[4]).toContain("assinado_por IN ('paciente', 'responsavel_legal')");
    expect(MIGRATIONS[4]).toContain('assinatura_png BLOB');
  });

  it('chega à versão 6 com as tarefas, o desenho e o traçado da #10', () => {
    const schemaV6 = MIGRATIONS[5];

    expect(schemaV6).toContain('CREATE TABLE IF NOT EXISTS tarefa');
    expect(schemaV6).toContain('REFERENCES avaliacao (id)');
    expect(schemaV6).toContain('CREATE TABLE IF NOT EXISTS desenho');
    expect(schemaV6).toContain('imagem_final BLOB NOT NULL');
    expect(schemaV6).toContain('CREATE TABLE IF NOT EXISTS evento_tracado');
  });

  it('chega à versão 7 registrando escolhas dos itens 9 e 10 do TCLE', () => {
    const schemaV7 = MIGRATIONS[6];
    expect(schemaV7).toContain('autoriza_imagens_pesquisa');
    expect(schemaV7).toContain('autoriza_dados_pesquisa_futura');
  });

  it('chega à versão 8 guardando só o CPF cifrado do responsável legal', () => {
    const schemaV8 = MIGRATIONS[7];
    expect(schemaV8).toContain('ALTER TABLE consentimento ADD COLUMN cpf_responsavel_cifrado');
    expect(schemaV8).not.toMatch(/cpf_responsavel\s+TEXT/);
  });

  it('chega à versão 9 com a tarefa, o motivo e a hora da desistência da #25', () => {
    const schemaV9 = MIGRATIONS[8];

    expect(schemaV9).toContain('ALTER TABLE avaliacao ADD COLUMN tarefa_interrupcao INTEGER');
    expect(schemaV9).toContain("motivo_interrupcao IN ('cansaco', 'nao_quis_continuar'");
    expect(schemaV9).toContain('ALTER TABLE avaliacao ADD COLUMN data_hora_interrupcao TEXT');
  });

  it('chega à versão 10 com a exclusão de exame (#58) e de paciente (#47)', () => {
    const schemaV10 = MIGRATIONS[9];

    expect(SCHEMA_VERSION).toBe(10);
    expect(schemaV10).toContain('ALTER TABLE avaliacao ADD COLUMN excluido_em TEXT');
    expect(schemaV10).toContain('CREATE TABLE IF NOT EXISTS exclusao');
    expect(schemaV10).toContain('avaliacao_finalizada_sem_exclusao');
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
    expect(mockApplyDatabaseEncryption).toHaveBeenCalledWith(database, expect.any(Function));
    expect(mockApplyDatabaseEncryption.mock.invocationCallOrder[0]).toBeLessThan(
      database.withTransactionAsync.mock.invocationCallOrder[0],
    );
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

  it('tenta abrir de novo depois de uma falha ao aplicar a chave', async () => {
    const database = createDatabase();
    mockOpenDatabaseAsync.mockResolvedValue(database);
    mockApplyDatabaseEncryption
      .mockRejectedValueOnce(new Error('cofre indisponível'))
      .mockResolvedValueOnce(undefined);

    await expect(getDatabase()).rejects.toThrow('cofre indisponível');
    expect(database.closeAsync).toHaveBeenCalledTimes(1);
    await expect(getDatabase()).resolves.toBe(database);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it('fecha a conexão quando uma migração falha', async () => {
    const database = createDatabase();
    database.execAsync.mockRejectedValueOnce(new Error('migração falhou'));
    mockOpenDatabaseAsync.mockResolvedValue(database);

    await expect(getDatabase()).rejects.toThrow('migração falhou');
    expect(database.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('preserva a falha original mesmo se o fechamento da conexão falhar', async () => {
    const database = createDatabase();
    database.closeAsync.mockRejectedValueOnce(new Error('falha ao fechar'));
    mockApplyDatabaseEncryption.mockRejectedValueOnce(new Error('cofre indisponível'));
    mockOpenDatabaseAsync.mockResolvedValue(database);

    await expect(getDatabase()).rejects.toThrow('cofre indisponível');
    await expect(getDatabase()).resolves.toBe(database);
  });

  it('identifica um banco antigo antes de abri-lo', async () => {
    const close = jest.fn();
    mockFile.exists = true;
    mockFile.size = 100;
    mockFile.open.mockReturnValue({
      readBytes: () => Uint8Array.from('SQLite format 3\0', (c) => c.charCodeAt(0)),
      close,
    });

    await expect(getDatabase()).rejects.toThrow(LEGACY_DATABASE_MESSAGE);
    expect(close).toHaveBeenCalled();
    expect(mockOpenDatabaseAsync).not.toHaveBeenCalled();
  });

  it('procura o arquivo do banco por uma URI file:// no diretório do SQLite', async () => {
    mockOpenDatabaseAsync.mockResolvedValue(createDatabase());

    await getDatabase();

    expect(File).toHaveBeenCalledWith('file:///sqlite', DATABASE_NAME);
  });

  it('não deixa criar outra chave quando já existe um banco cifrado', async () => {
    const close = jest.fn();
    mockFile.exists = true;
    mockFile.size = 4096;
    mockFile.open.mockReturnValue({
      readBytes: () => new Uint8Array(16).fill(0xa5),
      close,
    });
    mockOpenDatabaseAsync.mockResolvedValue(createDatabase());

    await getDatabase();
    await loadKeyPassedToEncryption();

    expect(close).toHaveBeenCalled();
    expect(mockLoadOrCreateDatabaseKey).toHaveBeenCalledWith(undefined, undefined, true);
  });

  it('permite criar a chave na primeira instalação, sem arquivo do banco', async () => {
    mockOpenDatabaseAsync.mockResolvedValue(createDatabase());

    await getDatabase();
    await loadKeyPassedToEncryption();

    expect(mockLoadOrCreateDatabaseKey).toHaveBeenCalledWith(undefined, undefined, false);
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
