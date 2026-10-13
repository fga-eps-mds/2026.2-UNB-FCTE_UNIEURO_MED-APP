import { professionalRepository } from '@/db/professional-repository';
import type { AccountRepository } from '@/features/auth/account';
import type { CredentialsRepository } from '@/features/auth/authentication';
import type { ProfessionalRepository } from '@/features/auth/registration';

/**
 * Entrega às rotas o acesso ao banco do módulo de acesso, para que as telas
 * não importem `@/db` (regra de camadas do CLAUDE.md).
 */
export const credentialsRepository: CredentialsRepository = professionalRepository;

export const registrationRepository: ProfessionalRepository = professionalRepository;

export const accountRepository: AccountRepository = professionalRepository;
