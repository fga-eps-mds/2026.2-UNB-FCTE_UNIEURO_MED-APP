import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { getRandomBytesAsync } from 'expo-crypto';

const ALGORITHM = 'pbkdf2-sha256';
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Hash de formato válido, mas de nenhuma senha real. Usado para rodar
 * `verifyPassword` mesmo quando o e-mail não existe, igualando o tempo de
 * resposta ao de um login com e-mail existente e evitando que a diferença de
 * tempo revele quais e-mails estão cadastrados.
 */
export const DUMMY_PASSWORD_HASH = [
  ALGORITHM,
  ITERATIONS,
  '0'.repeat(SALT_BYTES * 2),
  '0'.repeat(KEY_BYTES * 2),
].join('$');

function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  return pbkdf2Async(sha256, password, salt, { c: iterations, dkLen: KEY_BYTES });
}

function constantTimeEquals(first: Uint8Array, second: Uint8Array) {
  if (first.length !== second.length) return false;

  let difference = 0;
  for (let index = 0; index < first.length; index++) {
    difference |= first[index] ^ second[index];
  }
  return difference === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await getRandomBytesAsync(SALT_BYTES);
  const key = await deriveKey(password, salt, ITERATIONS);
  return [ALGORITHM, ITERATIONS, bytesToHex(salt), bytesToHex(key)].join('$');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, iterationsText, saltHex, keyHex] = storedHash.split('$');
  const iterations = Number(iterationsText);

  if (algorithm !== ALGORITHM || !Number.isInteger(iterations) || iterations < 1) return false;
  if (!saltHex || !keyHex) return false;

  const computedKey = await deriveKey(password, hexToBytes(saltHex), iterations);
  return constantTimeEquals(computedKey, hexToBytes(keyHex));
}
