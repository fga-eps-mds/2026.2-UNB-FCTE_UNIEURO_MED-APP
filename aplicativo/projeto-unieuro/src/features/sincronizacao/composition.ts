import { professionalRepository } from '@/db/professional-repository';
import { loadNearby } from '@/features/sincronizacao/nearby-module';
import { createPasswordConfirmation } from '@/features/sincronizacao/password-confirmation';
import { createSyncService } from '@/features/sincronizacao/sync-service';

// A rota importa daqui, e não de `@/db` (regra de camadas).
export const syncService = createSyncService();

/** `null` no Expo Go. */
export const nearbyApi = loadNearby();

export const confirmPassword = createPasswordConfirmation(professionalRepository);
