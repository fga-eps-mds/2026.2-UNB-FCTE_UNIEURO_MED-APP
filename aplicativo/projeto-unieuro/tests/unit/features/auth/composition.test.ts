import { professionalRepository } from '@/db/professional-repository';
import { credentialsRepository, registrationRepository } from '@/features/auth/composition';

describe('composição da feature de autenticação', () => {
  it('liga o login ao repositório de profissionais', () => {
    expect(credentialsRepository).toBe(professionalRepository);
  });

  it('liga o cadastro ao repositório de profissionais', () => {
    expect(registrationRepository).toBe(professionalRepository);
  });
});
