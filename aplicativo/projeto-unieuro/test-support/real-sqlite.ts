import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * SQLite de verdade para os testes de integração, usando o módulo `node:sqlite`
 * que já vem no Node usado pela esteira (22 ou superior). Ele implementa só o que
 * o aplicativo usa do `expo-sqlite`. O módulo é obtido por `getBuiltinModule`
 * porque o resolvedor do Jest não conhece módulos que só existem com o prefixo
 * `node:`.
 */

type Statement = {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
};
type NodeDatabase = { exec(sql: string): void; prepare(sql: string): Statement; close(): void };
type BuiltinLoader = { getBuiltinModule(id: string): unknown };

const loadBuiltin = <T>(id: string) =>
  (process as unknown as BuiltinLoader).getBuiltinModule(id) as T;

const { DatabaseSync } = loadBuiltin<{ DatabaseSync: new (path: string) => NodeDatabase }>(
  'node:sqlite',
);
const fs = loadBuiltin<{
  mkdtempSync(prefix: string): string;
  readFileSync(path: string): Uint8Array;
  existsSync(path: string): boolean;
  rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
}>('node:fs');
const os = loadBuiltin<{ tmpdir(): string }>('node:os');

export type TempDatabase = {
  path: string;
  open(): SQLiteDatabase;
  /**
   * Diz se o texto aparece no arquivo do banco ou no WAL, o que alguém veria ao
   * copiar o arquivo. Devolve só um booleano: se devolvesse o conteúdo, uma falha
   * de teste o imprimiria no log.
   */
  rawContains(text: string): boolean;
  cleanup(): void;
};

export function createTempDatabase(): TempDatabase {
  const directory = fs.mkdtempSync(`${os.tmpdir()}/med-test-`);
  const path = `${directory}/med.db`;

  const open = () => {
    const database = new DatabaseSync(path);
    const adapter = {
      async execAsync(sql: string) {
        database.exec(sql);
      },
      async runAsync(sql: string, params: unknown[] = []) {
        database.prepare(sql).run(...params);
      },
      async getFirstAsync(sql: string, params: unknown[] = []) {
        return database.prepare(sql).get(...params) ?? null;
      },
      async getAllAsync(sql: string, params: unknown[] = []) {
        return database.prepare(sql).all(...params);
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
  };

  const rawContains = (text: string) =>
    [path, `${path}-wal`]
      .filter((file) => fs.existsSync(file))
      .some((file) =>
        Array.from(fs.readFileSync(file), (byte) => String.fromCharCode(byte))
          .join('')
          .includes(text),
      );

  return {
    path,
    open,
    rawContains,
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}
