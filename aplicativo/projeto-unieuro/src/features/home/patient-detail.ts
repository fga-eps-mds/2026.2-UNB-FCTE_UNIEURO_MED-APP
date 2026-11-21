/**
 * Paciente e exames mostrados na tela do paciente (#59).
 *
 * Os dados vêm do registro do atendimento (#7). Este módulo converte e formata,
 * sem saber onde eles estão guardados.
 */
import {
  describeExamState,
  formatDate,
  toExamStatus,
  type ExamStatus,
  type ExamTone,
} from '@/features/home/patients';

/**
 * Paciente com os exames do profissional, como o repositório do atendimento
 * entrega. Espelha o `PatientWithExamsRecord` do banco, que esta camada não
 * importa; a `composition.ts` da feature confere, pelo tipo, que os dois batem.
 */
export type PatientWithExams = {
  id: number;
  name: string;
  recordNumber: string;
  /** AAAA-MM-DD. */
  birthDate: string;
  schoolingYears: number;
  sex: 'feminino' | 'masculino' | null;
  /** `appliedBy` só vem na consulta do superusuário (#49). */
  exams: { id: number; startedAt: string; state: string; appliedBy?: string }[];
};

export type PatientDetailRepository = {
  /** Devolve `null` se o paciente não existe ou não foi atendido por esse profissional. */
  findPatientWithExams(professionalId: number, patientId: number): Promise<PatientWithExams | null>;
  /**
   * Paciente com os exames de todos os profissionais. Só responde a um
   * superusuário (#49): para os demais, devolve `null`.
   */
  findAnyPatientWithExams(requesterId: number, patientId: number): Promise<PatientWithExams | null>;
};

/** Quem está pedindo o paciente: o profissional da sessão. */
export type PatientDetailViewer = {
  id: number;
  superuser?: boolean;
};

/**
 * Paciente como o profissional pode vê-lo: o superusuário vê os exames de todos,
 * com quem aplicou cada um, e o médico comum vê só os que ele aplicou (#49).
 */
export function findPatientWithExamsFor(
  viewer: PatientDetailViewer,
  repository: PatientDetailRepository,
  patientId: number,
): Promise<PatientWithExams | null> {
  return viewer.superuser === true
    ? repository.findAnyPatientWithExams(viewer.id, patientId)
    : repository.findPatientWithExams(viewer.id, patientId);
}

export type PatientExam = {
  id: number;
  /** Data e hora ISO do início do exame. */
  startedAt: string;
  /** Quem aplicou o exame, quando não foi o profissional da sessão (#49). */
  appliedBy?: string;
  /** Desfecho do exame, ou `null` enquanto ele não terminou. */
  status: ExamStatus | null;
  /** Texto da situação, que existe também para o exame que ainda não terminou. */
  label: string;
  tone: ExamTone;
};

export type PatientDetail = Omit<PatientWithExams, 'exams'> & { exams: PatientExam[] };

export const SEX_LABEL = {
  feminino: 'Feminino',
  masculino: 'Masculino',
  none: 'Não informado',
} as const;

function toPatientExam(exam: PatientWithExams['exams'][number]): PatientExam {
  const status = toExamStatus(exam.state);
  return {
    id: exam.id,
    startedAt: exam.startedAt,
    status,
    ...describeExamState(exam.state),
    ...(exam.appliedBy === undefined ? {} : { appliedBy: exam.appliedBy }),
  };
}

export function toPatientDetail(patient: PatientWithExams): PatientDetail {
  return { ...patient, exams: patient.exams.map(toPatientExam) };
}

/** Idade completa em anos de quem nasceu em `birthDate` (AAAA-MM-DD), na data de `now`. */
export function ageInYears(birthDate: string, now: Date = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  const hadBirthday =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  return now.getFullYear() - year - (hadBirthday ? 0 : 1);
}

const years = (count: number) => (count === 1 ? '1 ano' : `${count} anos`);

/** Data de nascimento e idade, por exemplo "14/03/1948 · 78 anos". */
export function describeAge(birthDate: string, now: Date = new Date()): string {
  return `${formatDate(birthDate)} · ${years(ageInYears(birthDate, now))}`;
}

export const formatSchooling = years;

/** Resumo do cabeçalho da lista, por exemplo "2 exames, do mais recente para o mais antigo". */
export function describeExams(count: number): string {
  return count === 1 ? '1 exame' : `${count} exames, do mais recente para o mais antigo`;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

/**
 * Data e hora no formato "DD/MM/AAAA · HH:MM", no horário do tablet. Como em
 * `formatDate`, o instante é convertido para o fuso do aparelho antes de escrito.
 */
export function formatDateTime(isoDateTime: string): string {
  return `${formatDate(isoDateTime)} · ${formatTime(isoDateTime)}`;
}

function formatTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/**
 * Frase única da linha do exame para o leitor de tela. Sem ela, o TalkBack lê a
 * data, o profissional e a situação como três itens separados.
 */
export function describeExamForReader(exam: PatientExam, professionalName: string): string {
  const when = `${formatDate(exam.startedAt)} às ${formatTime(exam.startedAt)}`;
  return `${when}, aplicado por ${professionalName}, ${exam.label}`;
}
