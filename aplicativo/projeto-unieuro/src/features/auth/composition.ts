import { professionalRepository } from '@/db/professional-repository';
import type { CredentialsRepository } from '@/features/auth/authentication';
import type { ProfessionalRepository } from '@/features/auth/registration';

export const credentialsRepository: CredentialsRepository = professionalRepository;

export const registrationRepository: ProfessionalRepository = professionalRepository;
