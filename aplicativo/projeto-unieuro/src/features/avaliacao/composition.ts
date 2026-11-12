import { attendanceRepository } from '@/db/attendance-repository';
import { consentRepository } from '@/db/consent-repository';
import { interruptionRepository } from '@/db/interruption-repository';
import type { AttendanceRepository } from '@/features/avaliacao/attendance';
import {
  registrarDecisaoConsentimento,
  verificarAcessoTarefas,
  type RegistrarDecisaoInput,
} from '@/features/avaliacao/consentimento';
import {
  desistirDoExame,
  retomarExame,
  type DesistenciaInput,
  type InterrupcaoRepository,
} from '@/features/avaliacao/interrupcao';

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

// A anotação confere que o repositório do banco, com tipos próprios, atende ao
// contrato da desistência: se os formatos divergirem, o `tsc` acusa aqui.
const interrupcaoRepository: InterrupcaoRepository = interruptionRepository;

/** Desistência do exame (#25): grava a interrupção na tarefa atual. */
export const giveUpExam = (input: DesistenciaInput) =>
  desistirDoExame(input, interrupcaoRepository);

export const loadInterruptedExam = (attendanceId: number, professionalId: number) =>
  interrupcaoRepository.buscarInterrompido(attendanceId, professionalId);

export const resumeExam = (attendanceId: number, professionalId: number) =>
  retomarExame(attendanceId, professionalId, interrupcaoRepository);
