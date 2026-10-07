/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { migrate } from '@/db/database';

type Params = SQLInputValue[];

/**
 * Banco SQLite de verdade, em memória, para os testes de integração.
 *
 * O `expo-sqlite` só roda dentro do aplicativo. Aqui o `node:sqlite` (Node 22)
 * faz o papel dele, com os métodos do `SQLiteDatabase` que os repositórios
 * usam. O SQL, as restrições e as migrations são os mesmos do tablet.
 */
export function createMemoryDatabase(): SQLiteDatabase {
  const database = new DatabaseSync(':memory:');

  const adapter = {
    async execAsync(source: string) {
      database.exec(source);
    },
    async getFirstAsync<T>(source: string, params: Params = []) {
      const row = database.prepare(source).get(...params);
      return (row ? { ...row } : null) as T | null;
    },
    async getAllAsync<T>(source: string, params: Params = []) {
      return database
        .prepare(source)
        .all(...params)
        .map((row) => ({ ...row })) as T[];
    },
    async runAsync(source: string, params: Params = []) {
      const result = database.prepare(source).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async withTransactionAsync(task: () => Promise<void>) {
      database.exec('BEGIN');
      try {
        await task();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    async closeAsync() {
      database.close();
    },
  };

  return adapter as unknown as SQLiteDatabase;
}

/** Banco em memória já com todas as migrations aplicadas, como no tablet. */
export async function openTestDatabase(): Promise<SQLiteDatabase> {
  const database = createMemoryDatabase();
  await migrate(database);
  return database;
}
