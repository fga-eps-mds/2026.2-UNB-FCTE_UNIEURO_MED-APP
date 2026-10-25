import { attendanceRepository } from '@/db/attendance-repository';
import { consentRepository } from '@/db/consent-repository';
import type { AttendanceRepository } from '@/features/avaliacao/attendance';
import {
  registrarDecisaoConsentimento,
  verificarAcessoTarefas,
  type RegistrarDecisaoInput,
} from '@/features/avaliacao/consentimento';

/**
 * Liga a regra do atendimento ao banco. As rotas e a tela importam daqui, e não
 * de `@/db`, para respeitar a regra de camadas (o lint barra o import direto).
 */
export const registerAttendanceRepository: AttendanceRepository = attendanceRepository;

/** Liga as regras do consentimento ao SQLite sem expor a camada de banco às telas. */
export const registerConsentDecision = (input: RegistrarDecisaoInput) =>
  registrarDecisaoConsentimento(input, consentRepository);

export const getTaskAccess = (attendanceId: number) =>
  verificarAcessoTarefas(attendanceId, consentRepository);

/** Nome e ficha do paciente do atendimento, para o cabeçalho do TCLE. */
export const getAttendancePatient = (attendanceId: number) =>
  attendanceRepository.findPatientOfAttendance(attendanceId);
