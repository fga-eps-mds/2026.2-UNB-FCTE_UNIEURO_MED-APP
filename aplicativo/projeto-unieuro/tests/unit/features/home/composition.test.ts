import { attendanceRepository } from '@/db/attendance-repository';
import { examRepository } from '@/db/exam-repository';
import { exameRepository, patientListRepository } from '@/features/home/composition';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

describe('composição da tela inicial', () => {
  it('liga a lista de pacientes ao repositório do atendimento', () => {
    expect(patientListRepository).toBe(attendanceRepository);
  });

  it('liga o "Ver exame" ao repositório do exame', () => {
    expect(exameRepository).toBe(examRepository);
  });
});
