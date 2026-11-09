import type { SQLiteDatabase } from 'expo-sqlite';

import { applyDatabaseEncryption, SQLCIPHER_UNAVAILABLE_MESSAGE } from '@/db/database-encryption';

function createDatabase(cipherVersion: string | null) {
  return {
    getFirstAsync: jest.fn(async () =>
      cipherVersion === null ? null : { cipher_version: cipherVersion },
    ),
    execAsync: jest.fn(async () => undefined),
  } as unknown as SQLiteDatabase & {
    getFirstAsync: jest.Mock;
    execAsync: jest.Mock;
  };
}

describe('applyDatabaseEncryption', () => {
  it('confirma o SQLCipher e aplica os 32 bytes da chave antes do uso', async () => {
    const database = createDatabase('4.6.1 community');
    const key = new Uint8Array(32).fill(10);

    await applyDatabaseEncryption(database, async () => key);

    expect(database.getFirstAsync).toHaveBeenCalledWith('PRAGMA cipher_version');
    expect(database.execAsync).toHaveBeenCalledWith(`PRAGMA key = "x'${'0a'.repeat(32)}'";`);
    expect(database.getFirstAsync.mock.invocationCallOrder[0]).toBeLessThan(
      database.execAsync.mock.invocationCallOrder[0],
    );
  });

  it('falha sem criar uma chave quando o APK não inclui SQLCipher', async () => {
    const database = createDatabase(null);
    const loadKey = jest.fn();

    await expect(applyDatabaseEncryption(database, loadKey)).rejects.toThrow(
      SQLCIPHER_UNAVAILABLE_MESSAGE,
    );
    expect(loadKey).not.toHaveBeenCalled();
    expect(database.execAsync).not.toHaveBeenCalled();
  });

  it('propaga a falha do cofre sem aplicar uma chave vazia', async () => {
    const database = createDatabase('4.6.1 community');

    await expect(
      applyDatabaseEncryption(database, async () => {
        throw new Error('cofre indisponível');
      }),
    ).rejects.toThrow('cofre indisponível');
    expect(database.execAsync).not.toHaveBeenCalled();
  });
});
