import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME, MIGRATIONS, SCHEMA_VERSION } from '@/db/schema';

let connection: Promise<SQLiteDatabase> | null = null;

/**
 * Aplica os passos de `MIGRATIONS` que o banco ainda não recebeu. A versão
 * atual fica guardada no `PRAGMA user_version`, como no script do MED-IA.
 */
export async function migrate(database: SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const current = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = current?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  await database.withTransactionAsync(async () => {
    for (const step of MIGRATIONS.slice(version)) {
      await database.execAsync(step);
    }
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync(DATABASE_NAME);
  await migrate(database);
  return database;
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
