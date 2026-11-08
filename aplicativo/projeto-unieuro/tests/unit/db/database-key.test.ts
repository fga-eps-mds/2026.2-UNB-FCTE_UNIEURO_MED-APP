import { bytesToHex } from '@noble/hashes/utils';
import { getRandomBytesAsync } from 'expo-crypto';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

import {
  DATABASE_KEY_BYTES,
  DATABASE_KEY_NAME,
  DATABASE_KEY_MISSING_MESSAGE,
  loadOrCreateDatabaseKey,
  type DatabaseKeyStore,
} from '@/db/database-key';

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

function createStore(saved: string | null): DatabaseKeyStore & { get: jest.Mock; set: jest.Mock } {
  return {
    get: jest.fn(async () => saved),
    set: jest.fn(async () => undefined),
  };
}

describe('loadOrCreateDatabaseKey', () => {
  it('reutiliza a chave de um banco existente sem sobrescrevê-la', async () => {
    const store = createStore('ab'.repeat(DATABASE_KEY_BYTES));
    const randomBytes = jest.fn();

    const key = await loadOrCreateDatabaseKey(store, randomBytes, true);

    expect(bytesToHex(key)).toBe('ab'.repeat(DATABASE_KEY_BYTES));
    expect(randomBytes).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });
  it('não cria outra chave quando existe um banco com dados', async () => {
    const store = createStore(null);
    const randomBytes = jest.fn();
    await expect(loadOrCreateDatabaseKey(store, randomBytes, true)).rejects.toThrow(
      DATABASE_KEY_MISSING_MESSAGE,
    );
    expect(randomBytes).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });
  it('gera 256 bits e guarda a chave fora do banco no primeiro uso', async () => {
    const store = createStore(null);
    const generated = new Uint8Array(DATABASE_KEY_BYTES).fill(7);
    const randomBytes = jest.fn(async () => generated);

    const key = await loadOrCreateDatabaseKey(store, randomBytes);

    expect(key).toEqual(generated);
    expect(randomBytes).toHaveBeenCalledWith(DATABASE_KEY_BYTES);
    expect(store.set).toHaveBeenCalledWith(DATABASE_KEY_NAME, bytesToHex(generated));
  });

  it('reutiliza a chave existente sem gerar nem gravar outra', async () => {
    const saved = 'ab'.repeat(DATABASE_KEY_BYTES);
    const store = createStore(saved);
    const randomBytes = jest.fn();

    const key = await loadOrCreateDatabaseKey(store, randomBytes);

    expect(bytesToHex(key)).toBe(saved);
    expect(randomBytes).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it('usa o SecureStore do aparelho por padrão', async () => {
    const generated = new Uint8Array(DATABASE_KEY_BYTES).fill(9);
    jest.mocked(getItemAsync).mockResolvedValueOnce(null);
    jest.mocked(getRandomBytesAsync).mockResolvedValueOnce(generated);

    const key = await loadOrCreateDatabaseKey();

    expect(getItemAsync).toHaveBeenCalledWith(DATABASE_KEY_NAME);
    expect(setItemAsync).toHaveBeenCalledWith(DATABASE_KEY_NAME, bytesToHex(generated));
    expect(key).toEqual(generated);
  });

  it.each(['', 'ab', 'g0'.repeat(DATABASE_KEY_BYTES), 'AA'.repeat(DATABASE_KEY_BYTES)])(
    'recusa a chave inválida %j sem sobrescrevê-la',
    async (saved) => {
      const store = createStore(saved);

      await expect(loadOrCreateDatabaseKey(store)).rejects.toThrow(
        'A chave do banco guardada no cofre é inválida.',
      );
      expect(store.set).not.toHaveBeenCalled();
    },
  );

  it('não guarda uma chave gerada com tamanho inesperado', async () => {
    const store = createStore(null);

    await expect(
      loadOrCreateDatabaseKey(store, async () => new Uint8Array(DATABASE_KEY_BYTES - 1)),
    ).rejects.toThrow('Não foi possível gerar uma chave segura para o banco.');
    expect(store.set).not.toHaveBeenCalled();
  });
});
