import { professionalRepository } from '@/db/professional-repository';
import type { AccountRepository } from '@/features/auth/account';

/**
 * Entrega às rotas o acesso ao banco do módulo de acesso, para que as telas
 * não importem `@/db` (regra de camadas do CLAUDE.md).
 */
export const accountRepository: AccountRepository = professionalRepository;
