import { attendanceRepository } from '@/db/attendance-repository';
import { registerAttendanceRepository } from '@/features/avaliacao/composition';

describe('composição da feature de avaliação', () => {
  it('liga o registro do atendimento ao repositório do banco', () => {
    expect(registerAttendanceRepository).toBe(attendanceRepository);
  });
});
