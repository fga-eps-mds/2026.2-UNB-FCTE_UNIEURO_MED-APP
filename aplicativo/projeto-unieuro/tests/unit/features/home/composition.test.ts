import { attendanceRepository } from '@/db/attendance-repository';
import { patientListRepository } from '@/features/home/composition';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

describe('composição da tela inicial', () => {
  it('liga a lista de pacientes ao repositório do atendimento', () => {
    expect(patientListRepository).toBe(attendanceRepository);
  });
});
