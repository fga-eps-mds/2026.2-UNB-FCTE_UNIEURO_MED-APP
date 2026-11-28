import { attendanceRepository } from '@/db/attendance-repository';
import { consentRepository } from '@/db/consent-repository';
import { interruptionRepository } from '@/db/interruption-repository';
import { markingRepository } from '@/db/marking-repository';
import { professionalRepository } from '@/db/professional-repository';
import type { SessionProfessional } from '@/features/auth/session';
import type { AttendanceRepository } from '@/features/avaliacao/attendance';
import type { ProfessionalCpfRepository } from '@/features/avaliacao/confirmacao-profissional';
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
import {
  desmarcarExame,
  desmarcarPaciente,
  marcarExame,
  marcarPaciente,
  type TipoMarcacao,
} from '@/features/avaliacao/marcacao';

/**
 * Liga a regra do atendimento ao banco. As rotas e a tela importam daqui, e não
 * de `@/db`, para respeitar a regra de camadas (o lint barra o import direto).
 */
export const registerAttendanceRepository: AttendanceRepository = attendanceRepository;

/** Lê o CPF protegido somente durante a confirmação ao final do teste. */
export const professionalCpfRepository: ProfessionalCpfRepository = professionalRepository;

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

/** Marca o exame como teste ou material de ensino (#58), confirmado pela senha do profissional. */
export const markExam = (
  attendanceId: number,
  professional: SessionProfessional,
  type: TipoMarcacao | null,
  password: string,
) =>
  marcarExame(
    { atendimentoId: attendanceId, profissional: professional, tipo: type, senha: password },
    markingRepository,
    professionalRepository,
  );

/** Desfaz a marcação do exame (#58), confirmado pela senha do profissional. */
export const unmarkExam = (
  attendanceId: number,
  professional: SessionProfessional,
  password: string,
) =>
  desmarcarExame(
    { atendimentoId: attendanceId, profissional: professional, senha: password },
    markingRepository,
    professionalRepository,
  );

/** Marca os exames que o profissional aplicou no paciente (#47), confirmado pela senha dele. */
export const markPatient = (
  patientId: number,
  professional: SessionProfessional,
  type: TipoMarcacao | null,
  password: string,
) =>
  marcarPaciente(
    { pacienteId: patientId, profissional: professional, tipo: type, senha: password },
    markingRepository,
    professionalRepository,
  );

/** Desfaz a marcação dos exames do paciente aplicados pelo profissional (#47). */
export const unmarkPatient = (
  patientId: number,
  professional: SessionProfessional,
  password: string,
) =>
  desmarcarPaciente(
    { pacienteId: patientId, profissional: professional, senha: password },
    markingRepository,
    professionalRepository,
  );
