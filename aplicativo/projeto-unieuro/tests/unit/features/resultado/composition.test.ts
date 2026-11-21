import { examResultRepository } from '@/db/exam-result-repository';
import { resultadoRepository } from '@/features/resultado/composition';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

describe('composição da tela de resultado', () => {
  it('liga a tela de resultado ao repositório do banco', () => {
    expect(resultadoRepository).toBe(examResultRepository);
  });
});
