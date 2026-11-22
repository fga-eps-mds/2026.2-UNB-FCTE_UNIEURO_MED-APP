import { professionalRepository } from '@/db/professional-repository';
import { contasRepository } from '@/features/superusuario/composition';

jest.mock('@/db/professional-repository', () => ({
  professionalRepository: { listAccounts: jest.fn() },
}));

it('liga as contas da área do superusuário ao repositório de profissionais do SQLite', () => {
  expect(contasRepository).toBe(professionalRepository);
});
