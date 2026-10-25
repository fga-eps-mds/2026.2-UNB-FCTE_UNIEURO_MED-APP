import { attendanceRepository } from '@/db/attendance-repository';
import { consentRepository } from '@/db/consent-repository';
import {
  getAttendancePatient,
  getTaskAccess,
  registerAttendanceRepository,
  registerConsentDecision,
} from '@/features/avaliacao/composition';
import {
  registrarDecisaoConsentimento,
  verificarAcessoTarefas,
} from '@/features/avaliacao/consentimento';

jest.mock('@/features/avaliacao/consentimento', () => ({
  registrarDecisaoConsentimento: jest.fn(),
  verificarAcessoTarefas: jest.fn(),
}));

describe('composição da feature de avaliação', () => {
  it('liga o registro do atendimento ao repositório do banco', () => {
    expect(registerAttendanceRepository).toBe(attendanceRepository);
  });

  it('liga a decisão do consentimento ao repositório do banco', () => {
    const input = {
      atendimentoId: 12,
      aceito: true as const,
      assinaturaPng: new Uint8Array([137, 80, 78, 71]),
      versaoTermo: '2026-09-15',
      quemAssina: 'paciente' as const,
    };

    registerConsentDecision(input);

    expect(registrarDecisaoConsentimento).toHaveBeenCalledWith(input, consentRepository);
  });

  it('liga o portão das tarefas ao estado salvo no banco', () => {
    getTaskAccess(12);

    expect(verificarAcessoTarefas).toHaveBeenCalledWith(12, consentRepository);
  });

  it('liga o cabeçalho do termo ao paciente do atendimento no banco', () => {
    const buscar = jest
      .spyOn(attendanceRepository, 'findPatientOfAttendance')
      .mockResolvedValue({ name: 'José Alves Martins', recordNumber: '2026-0184' });

    void getAttendancePatient(12);

    expect(buscar).toHaveBeenCalledWith(12);
  });
});
