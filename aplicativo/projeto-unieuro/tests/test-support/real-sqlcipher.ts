import type { SQLiteDatabase } from 'expo-sqlite';

import {
  adaptDatabase,
  loadBuiltin,
  rawFileContains,
  readRawFile,
  type NodeDatabase,
} from './real-sqlite';

/**
 * Banco cifrado de verdade para os testes, no lugar do `node:sqlite`, que não
 * tem cifra. Usa o SQLite3 Multiple Ciphers no modo de compatibilidade com o
 * SQLCipher 4, o mesmo formato que o `expo-sqlite` grava no tablet com
 * `useSQLCipher`: `PRAGMA key = "x'...'"` e o arquivo inteiro cifrado.
 *
 * O que este módulo prova: o formato da chave que o aplicativo envia, o arquivo
 * ilegível em disco (inclusive no WAL) e a recusa de chave ausente ou errada.
 * O que ele não prova: que o APK foi compilado com SQLCipher. Isso é conferido
 * no aparelho (`PRAGMA cipher_version` em `database-encryption.ts`).
 *
 * O módulo é carregado com `jest.requireActual` porque o pacote declara seus
 * tipos de um jeito que o TypeScript do projeto não resolve.
 */

type CipherDatabase = NodeDatabase & { pragma(source: string): unknown };

const Database = jest.requireActual<new (path: string) => CipherDatabase>(
  'better-sqlite3-multiple-ciphers',
);

const fs = loadBuiltin<{
  mkdtempSync(prefix: string): string;
  copyFileSync(from: string, to: string): void;
  existsSync(path: string): boolean;
  rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
}>('node:fs');
const os = loadBuiltin<{ tmpdir(): string }>('node:os');

/** O PRAGMA do SQLCipher que o SQLite3 Multiple Ciphers não tem. */
const CIPHER_VERSION_PRAGMA = 'PRAGMA cipher_version';
const CIPHER_VERSION_REPLY = { cipher_version: 'sqlite3mc em modo SQLCipher 4' };

export type TempCipherDatabase = {
  path: string;
  /**
   * Abre o arquivo já no dialeto do SQLCipher 4, mas sem chave: quem testa
   * aplica a chave, como o aplicativo faz.
   */
  open(): SQLiteDatabase;
  /** Diz se o texto aparece no arquivo ou no WAL, o que alguém veria ao copiá-lo. */
  rawContains(text: string): boolean;
  /** Os 16 primeiros bytes do arquivo, onde o SQLite comum grava o seu cabeçalho. */
  header(): string;
  /** Copia o arquivo e o WAL para outra pasta, como quem leva o banco do tablet. */
  copy(): TempCipherDatabase;
  cleanup(): void;
};

function createAt(directory: string): TempCipherDatabase {
  const path = `${directory}/med.db`;

  const open = () => {
    const database = new Database(path);
    database.pragma("cipher='sqlcipher'");
    database.pragma('legacy=4');
    const adapter = adaptDatabase(database);
    const getFirst = adapter.getFirstAsync.bind(adapter) as (
      sql: string,
      params?: unknown[],
    ) => Promise<unknown>;
    return {
      ...adapter,
      getFirstAsync: (sql: string, params?: unknown[]) =>
        sql === CIPHER_VERSION_PRAGMA
          ? Promise.resolve(CIPHER_VERSION_REPLY)
          : getFirst(sql, params),
    } as unknown as SQLiteDatabase;
  };

  return {
    path,
    open,
    rawContains: (text) => rawFileContains(path, text),
    header: () =>
      Array.from(readRawFile(path)?.subarray(0, 16) ?? [], (byte) =>
        String.fromCharCode(byte),
      ).join(''),
    copy() {
      const target = fs.mkdtempSync(`${os.tmpdir()}/med-test-copia-`);
      for (const suffix of ['', '-wal']) {
        if (fs.existsSync(`${path}${suffix}`)) {
          fs.copyFileSync(`${path}${suffix}`, `${target}/med.db${suffix}`);
        }
      }
      return createAt(target);
    },
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

export function createTempCipherDatabase(): TempCipherDatabase {
  return createAt(fs.mkdtempSync(`${os.tmpdir()}/med-test-cifra-`));
}
