import { attendanceRepository } from '@/db/attendance-repository';
import { patientDetailRepository, patientListRepository } from '@/features/home/composition';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

describe('composição da tela inicial', () => {
  it('liga a lista de pacientes ao repositório do atendimento', () => {
    expect(patientListRepository).toBe(attendanceRepository);
  });

  it('liga a tela do paciente ao repositório do atendimento', () => {
    expect(patientDetailRepository).toBe(attendanceRepository);
  });
});
