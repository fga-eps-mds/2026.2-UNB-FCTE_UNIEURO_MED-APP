import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';

import type { RecoveryAttempts, RecoveryAttemptsStore } from '@/features/auth/password-recovery';

export const RECOVERY_ATTEMPTS_KEY = 'med.recuperacao-senha.tentativas.v1';

const NO_ATTEMPTS: RecoveryAttempts = { failures: 0, blockedUntil: null };

export type SecureValueStore = {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
};

const secureValueStore: SecureValueStore = {
  get: (name) => getItemAsync(name),
  set: (name, value) => setItemAsync(name, value),
  remove: (name) => deleteItemAsync(name),
};

// O cofre só guarda texto, então o valor lido é conferido antes de entrar na contagem.
function parseAttempts(saved: string): RecoveryAttempts | null {
  try {
    const { failures, blockedUntil } = JSON.parse(saved);
    const validFailures = Number.isInteger(failures) && failures >= 0;
    const validBlock = blockedUntil === null || !Number.isNaN(Date.parse(blockedUntil));
    return validFailures && validBlock ? { failures, blockedUntil } : null;
  } catch {
    return null;
  }
}

// As tentativas ficam no cofre do Android, fora do SQLite, para a contagem não depender de
// migration nova nem viajar na sincronização entre tablets (#118): o limite vale por
// aparelho. Valor ilegível conta como nenhuma tentativa, para não travar a recuperação.
export function createRecoveryAttemptsStore(
  store: SecureValueStore = secureValueStore,
): RecoveryAttemptsStore {
  return {
    async read() {
      const saved = await store.get(RECOVERY_ATTEMPTS_KEY);
      return (saved && parseAttempts(saved)) || NO_ATTEMPTS;
    },

    async write(attempts) {
      // Sem falha não há o que guardar, e o aparelho não fica com rastro da recuperação.
      if (attempts.failures === 0) {
        await store.remove(RECOVERY_ATTEMPTS_KEY);
        return;
      }
      await store.set(RECOVERY_ATTEMPTS_KEY, JSON.stringify(attempts));
    },
  };
}

export const recoveryAttemptsStore = createRecoveryAttemptsStore();
