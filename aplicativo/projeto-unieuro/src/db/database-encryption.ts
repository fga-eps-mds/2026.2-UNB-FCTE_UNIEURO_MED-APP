import { bytesToHex } from '@noble/hashes/utils';
import type { SQLiteDatabase } from 'expo-sqlite';

import { loadOrCreateDatabaseKey } from '@/db/database-key';

export const SQLCIPHER_UNAVAILABLE_MESSAGE =
  'SQLCipher não está disponível neste APK. Gere um novo build nativo com useSQLCipher habilitado.';

type LoadDatabaseKey = () => Promise<Uint8Array>;
type CipherVersion = { cipher_version: string };

/**
 * Aplica a chave antes de qualquer leitura do conteúdo do banco. O teste de
 * `cipher_version` evita a falsa sensação de segurança do Expo Go, no qual um
 * `PRAGMA key` desconhecido seria ignorado e o arquivo continuaria em texto claro.
 */
export async function applyDatabaseEncryption(
  database: SQLiteDatabase,
  loadKey: LoadDatabaseKey = loadOrCreateDatabaseKey,
): Promise<void> {
  const cipher = await database.getFirstAsync<CipherVersion>('PRAGMA cipher_version');
  if (!cipher?.cipher_version) throw new Error(SQLCIPHER_UNAVAILABLE_MESSAGE);

  const key = await loadKey();
  const keyHex = bytesToHex(key);

  // A forma x'...' entrega ao SQLCipher os 32 bytes aleatórios diretamente, sem
  // transformá-los numa senha nem interpolar caracteres controlados pelo usuário.
  await database.execAsync(`PRAGMA key = "x'${keyHex}'";`);
}
