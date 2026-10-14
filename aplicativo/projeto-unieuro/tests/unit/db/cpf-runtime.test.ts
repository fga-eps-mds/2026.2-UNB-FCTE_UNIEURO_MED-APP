import { bytesToHex } from '@noble/hashes/utils';
import { getRandomBytesAsync } from 'expo-crypto';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

import {
  cpfProtector,
  expoAesGcm,
  loadOrCreateMasterKey,
  MASTER_KEY_NAME,
  type KeyStore,
} from '@/db/cpf-runtime';

// O módulo nativo de AES não existe nos testes. Este substituto segue o contrato
// do `expo-crypto` (chave importada, dado selado, `combined`) usando o AES-GCM do
// Web Crypto, de modo que a cifra exercitada aqui é de verdade.
jest.mock('expo-crypto', () => {
  const webCrypto = globalThis.crypto;
  const importKey = (key: { bytes: Uint8Array }) =>
    webCrypto.subtle.importKey('raw', key.bytes as BufferSource, 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);

  class AESEncryptionKey {
    bytes: Uint8Array;
    constructor(keyBytes: Uint8Array) {
      this.bytes = keyBytes;
    }
    static async import(keyBytes: Uint8Array) {
      return new AESEncryptionKey(keyBytes);
    }
  }

  class AESSealedData {
    data: Uint8Array;
    constructor(sealedBytes: Uint8Array) {
      this.data = sealedBytes;
    }
    static fromCombined(combined: Uint8Array) {
      return new AESSealedData(combined);
    }
    async combined() {
      return this.data;
    }
  }

  return {
    AESEncryptionKey,
    AESSealedData,
    getRandomBytesAsync: jest.fn(async (count: number) =>
      webCrypto.getRandomValues(new Uint8Array(count)),
    ),
    aesEncryptAsync: jest.fn(async (plaintext: Uint8Array, key: AESEncryptionKey) => {
      const iv = webCrypto.getRandomValues(new Uint8Array(12));
      const body = await webCrypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        await importKey(key),
        plaintext as BufferSource,
      );
      const sealed = new Uint8Array(12 + body.byteLength);
      sealed.set(iv);
      sealed.set(new Uint8Array(body), 12);
      return new AESSealedData(sealed);
    }),
    aesDecryptAsync: jest.fn(async (sealed: AESSealedData, key: AESEncryptionKey) => {
      const body = await webCrypto.subtle.decrypt(
        { name: 'AES-GCM', iv: sealed.data.slice(0, 12) },
        await importKey(key),
        sealed.data.slice(12) as BufferSource,
      );
      return new Uint8Array(body);
    }),
  };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const CPF = '11144477735';

function createKeyStore(saved: string | null): KeyStore & { get: jest.Mock; set: jest.Mock } {
  return { get: jest.fn(async () => saved), set: jest.fn(async () => undefined) };
}

describe('loadOrCreateMasterKey', () => {
  it('cria e guarda uma chave de 32 bytes no primeiro uso', async () => {
    const store = createKeyStore(null);

    const key = await loadOrCreateMasterKey(store);

    expect(key).toHaveLength(32);
    expect(getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(store.set).toHaveBeenCalledWith(MASTER_KEY_NAME, bytesToHex(key));
  });

  it('reaproveita a chave já guardada, sem criar outra', async () => {
    const saved = '05'.repeat(32);
    const store = createKeyStore(saved);

    const key = await loadOrCreateMasterKey(store);

    expect(bytesToHex(key)).toBe(saved);
    expect(store.set).not.toHaveBeenCalled();
    expect(getRandomBytesAsync).not.toHaveBeenCalled();
  });

  it('usa o cofre seguro do aparelho por padrão', async () => {
    jest.mocked(getItemAsync).mockResolvedValueOnce(null);

    const key = await loadOrCreateMasterKey();

    expect(getItemAsync).toHaveBeenCalledWith(MASTER_KEY_NAME);
    expect(setItemAsync).toHaveBeenCalledWith(MASTER_KEY_NAME, bytesToHex(key));
  });
});

describe('expoAesGcm', () => {
  const key = new Uint8Array(32).fill(1);
  const plaintext = new Uint8Array([1, 2, 3, 4]);

  it('cifra e decifra com a mesma chave', async () => {
    const sealed = await expoAesGcm.seal(key, plaintext);

    expect(sealed).not.toEqual(plaintext);
    await expect(expoAesGcm.open(key, sealed)).resolves.toEqual(plaintext);
  });

  it('não decifra com outra chave', async () => {
    const sealed = await expoAesGcm.seal(key, plaintext);

    await expect(expoAesGcm.open(new Uint8Array(32).fill(2), sealed)).rejects.toThrow();
  });
});

describe('cpfProtector', () => {
  it('cifra e recupera o CPF com a chave guardada no cofre', async () => {
    jest.mocked(getItemAsync).mockResolvedValue('08'.repeat(32));

    const stored = await cpfProtector.encrypt(CPF);

    expect(stored).not.toContain(CPF);
    await expect(cpfProtector.decrypt(stored)).resolves.toBe(CPF);
    await expect(cpfProtector.blindIndex(CPF)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});
