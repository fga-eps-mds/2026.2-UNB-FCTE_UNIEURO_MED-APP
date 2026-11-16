import { professionalRepository } from '@/db/professional-repository';
import { recoveryAttemptsStore } from '@/db/recovery-attempts-store';
import {
  credentialsRepository,
  passwordRecoveryAttempts,
  passwordRecoveryRepository,
  registrationRepository,
} from '@/features/auth/composition';

describe('composição da feature de autenticação', () => {
  it('liga o login ao repositório de profissionais', () => {
    expect(credentialsRepository).toBe(professionalRepository);
  });

  it('liga o cadastro ao repositório de profissionais', () => {
    expect(registrationRepository).toBe(professionalRepository);
  });

  it('liga a recuperação da senha ao repositório de profissionais e ao cofre de tentativas', () => {
    expect(passwordRecoveryRepository).toBe(professionalRepository);
    expect(passwordRecoveryAttempts).toBe(recoveryAttemptsStore);
  });
});
