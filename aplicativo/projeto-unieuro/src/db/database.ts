import { File } from 'expo-file-system';
import { defaultDatabaseDirectory, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { CpfProtector } from '@/db/cpf-protection';
import { cpfProtector } from '@/db/cpf-runtime';
import { applyDatabaseEncryption } from '@/db/database-encryption';
import { loadOrCreateDatabaseKey } from '@/db/database-key';
import { DATABASE_NAME, MIGRATIONS, SCHEMA_VERSION } from '@/db/schema';

let connection: Promise<SQLiteDatabase> | null = null;

export const LEGACY_DATABASE_MESSAGE =
  'Banco de uma versão anterior encontrado. Reinstale o aplicativo para continuar. Os dados locais serão apagados.';

function inspectDatabaseFile(): boolean {
  // No Android, `defaultDatabaseDirectory` é um caminho sem esquema, e o
  // expo-file-system só aceita URI `file://`.
  const file = new File(`file://${defaultDatabaseDirectory}`, DATABASE_NAME);
  if (!file.exists || file.size === 0) return false;
  const handle = file.open();
  try {
    const header = handle.readBytes(16);
    const sqliteHeader = 'SQLite format 3\0';
    if (header.length === 16 && header.every((byte, i) => byte === sqliteHeader.charCodeAt(i))) {
      throw new Error(LEGACY_DATABASE_MESSAGE);
    }
  } finally {
    handle.close();
  }
  return true;
}

/**
 * Aplica os passos de `MIGRATIONS` que o banco ainda não recebeu. A versão
 * atual fica guardada no `PRAGMA user_version`, como no script do MED-IA.
 */
export async function migrate(
  database: SQLiteDatabase,
  protector: CpfProtector = cpfProtector,
): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const current = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = current?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  const pendingSteps = MIGRATIONS.slice(version);

  await database.withTransactionAsync(async () => {
    for (const step of pendingSteps) {
      if (typeof step === 'string') {
        await database.execAsync(step);
      } else {
        await step(database, protector);
      }
    }
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });

  // Apagar uma tabela não apaga o conteúdo do arquivo: as páginas liberadas e o
  // WAL continuam com o texto antigo, como o CPF anterior à proteção. Quando um
  // passo reescreve dados de um banco que já existia, o VACUUM refaz o arquivo e o
  // checkpoint esvazia o WAL. Ambos só podem rodar fora da transação.
  const rewritesExistingData = version > 0 && pendingSteps.some((step) => typeof step !== 'string');
  if (rewritesExistingData) {
    await database.execAsync('VACUUM; PRAGMA wal_checkpoint(TRUNCATE);');
  }
}

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const databaseHasData = inspectDatabaseFile();
  const database = await openDatabaseAsync(DATABASE_NAME);
  try {
    await applyDatabaseEncryption(database, () =>
      loadOrCreateDatabaseKey(undefined, undefined, databaseHasData),
    );
    await migrate(database);
    return database;
  } catch (error) {
    await database.closeAsync().catch(() => undefined);
    throw error;
  }
}

/**
 * Devolve a conexão única com o banco, abrindo e migrando na primeira chamada.
 * Se a abertura falhar, a próxima chamada tenta de novo.
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  connection ??= openAndMigrate().catch((error: unknown) => {
    connection = null;
    throw error;
  });
  return connection;
}

export async function closeDatabase(): Promise<void> {
  const pending = connection;
  connection = null;

  const database = await pending?.catch(() => null);
  await database?.closeAsync();
}
