import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { getRandomBytesAsync } from 'expo-crypto';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

export const DATABASE_KEY_NAME = 'med.database.key.v1';
export const DATABASE_KEY_BYTES = 32;
export const DATABASE_KEY_MISSING_MESSAGE =
  'A chave do banco existente não está disponível. Procure o suporte antes de reinstalar o aplicativo.';

const DATABASE_KEY_HEX_LENGTH = DATABASE_KEY_BYTES * 2;
const HEXADECIMAL = /^[0-9a-f]+$/;

export type DatabaseKeyStore = {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
};

type RandomBytes = (count: number) => Promise<Uint8Array>;

/**
 * O SecureStore usa o Android Keystore para proteger o valor e o mantém fora do
 * arquivo SQLite. Assim, copiar apenas o banco para outro aparelho não leva a
 * chave capaz de abri-lo.
 */
const secureKeyStore: DatabaseKeyStore = {
  get: (name) => getItemAsync(name),
  set: (name, value) => setItemAsync(name, value),
};

function decodeStoredKey(stored: string): Uint8Array {
  if (stored.length !== DATABASE_KEY_HEX_LENGTH || !HEXADECIMAL.test(stored)) {
    // Nunca substitui silenciosamente uma chave inválida: isso tornaria um banco
    // já cifrado definitivamente inacessível.
    throw new Error('A chave do banco guardada no cofre é inválida.');
  }
  return hexToBytes(stored);
}

/**
 * Lê a chave exclusiva do banco ou cria 256 bits aleatórios no primeiro uso.
 * A chave não é derivada de senha humana e nunca é gravada no SQLite.
 */
export async function loadOrCreateDatabaseKey(
  store: DatabaseKeyStore = secureKeyStore,
  randomBytes: RandomBytes = getRandomBytesAsync,
  databaseHasData = false,
): Promise<Uint8Array> {
  const saved = await store.get(DATABASE_KEY_NAME);
  if (saved !== null) return decodeStoredKey(saved);

  if (databaseHasData) throw new Error(DATABASE_KEY_MISSING_MESSAGE);

  const created = await randomBytes(DATABASE_KEY_BYTES);
  if (created.length !== DATABASE_KEY_BYTES) {
    throw new Error('Não foi possível gerar uma chave segura para o banco.');
  }

  await store.set(DATABASE_KEY_NAME, bytesToHex(created));
  return created;
}
