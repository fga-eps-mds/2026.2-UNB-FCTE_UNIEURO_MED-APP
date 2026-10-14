import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  getRandomBytesAsync,
} from 'expo-crypto';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

import { createCpfProtector, type AesGcm } from '@/db/cpf-protection';

export const MASTER_KEY_NAME = 'med.cpf.master-key.v1';
const MASTER_KEY_BYTES = 32;

export type KeyStore = {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
};

/** Guarda a chave no Android Keystore, fora do arquivo do banco. */
const secureKeyStore: KeyStore = {
  get: (name) => getItemAsync(name),
  set: (name, value) => setItemAsync(name, value),
};

/**
 * Devolve a chave-mestra do tablet, criando-a no primeiro uso. Ela fica fora do
 * banco de propósito: quem copiar o arquivo do banco não leva a chave junto.
 */
export async function loadOrCreateMasterKey(store: KeyStore = secureKeyStore): Promise<Uint8Array> {
  const saved = await store.get(MASTER_KEY_NAME);
  if (saved) return hexToBytes(saved);

  const created = await getRandomBytesAsync(MASTER_KEY_BYTES);
  await store.set(MASTER_KEY_NAME, bytesToHex(created));
  return created;
}

export const expoAesGcm: AesGcm = {
  async seal(key, plaintext) {
    const encryptionKey = await AESEncryptionKey.import(key);
    const sealed = await aesEncryptAsync(plaintext, encryptionKey);
    return sealed.combined();
  },

  async open(key, sealed) {
    const encryptionKey = await AESEncryptionKey.import(key);
    return aesDecryptAsync(AESSealedData.fromCombined(sealed), encryptionKey);
  },
};

export const cpfProtector = createCpfProtector(loadOrCreateMasterKey, expoAesGcm);
