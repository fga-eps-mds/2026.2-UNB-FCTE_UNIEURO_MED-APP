import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';

import {
  RECOVERY_ATTEMPTS_KEY,
  createRecoveryAttemptsStore,
  recoveryAttemptsStore,
  type SecureValueStore,
} from '@/db/recovery-attempts-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const BLOQUEIO = { failures: 5, blockedUntil: '2026-11-15T12:15:00.000Z' };

function cofre(guardado: string | null = null) {
  return {
    get: jest.fn(async () => guardado),
    set: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
  } satisfies SecureValueStore;
}

describe('leitura das tentativas', () => {
  it('devolve o que foi guardado', async () => {
    const store = cofre(JSON.stringify(BLOQUEIO));

    await expect(createRecoveryAttemptsStore(store).read()).resolves.toEqual(BLOQUEIO);
    expect(store.get).toHaveBeenCalledWith(RECOVERY_ATTEMPTS_KEY);
  });

  it.each([
    ['nada guardado', null],
    ['texto que não é JSON', 'tentativas'],
    ['falhas negativas', JSON.stringify({ failures: -1, blockedUntil: null })],
    ['falhas fracionadas', JSON.stringify({ failures: 1.5, blockedUntil: null })],
    ['data inválida', JSON.stringify({ failures: 5, blockedUntil: 'amanhã' })],
  ])('conta como nenhuma tentativa com %s', async (_caso, guardado) => {
    await expect(createRecoveryAttemptsStore(cofre(guardado)).read()).resolves.toEqual({
      failures: 0,
      blockedUntil: null,
    });
  });
});

describe('gravação das tentativas', () => {
  it('guarda as falhas e o fim do bloqueio no cofre', async () => {
    const store = cofre();

    await createRecoveryAttemptsStore(store).write(BLOQUEIO);

    expect(store.set).toHaveBeenCalledWith(RECOVERY_ATTEMPTS_KEY, JSON.stringify(BLOQUEIO));
  });

  it('apaga o registro quando a contagem volta a zero', async () => {
    const store = cofre();

    await createRecoveryAttemptsStore(store).write({ failures: 0, blockedUntil: null });

    expect(store.remove).toHaveBeenCalledWith(RECOVERY_ATTEMPTS_KEY);
    expect(store.set).not.toHaveBeenCalled();
  });
});

describe('cofre do aparelho', () => {
  it('usa o SecureStore do Expo', async () => {
    await recoveryAttemptsStore.read();
    await recoveryAttemptsStore.write(BLOQUEIO);
    await recoveryAttemptsStore.write({ failures: 0, blockedUntil: null });

    expect(getItemAsync).toHaveBeenCalledWith(RECOVERY_ATTEMPTS_KEY);
    expect(setItemAsync).toHaveBeenCalledWith(RECOVERY_ATTEMPTS_KEY, JSON.stringify(BLOQUEIO));
    expect(deleteItemAsync).toHaveBeenCalledWith(RECOVERY_ATTEMPTS_KEY);
  });
});
