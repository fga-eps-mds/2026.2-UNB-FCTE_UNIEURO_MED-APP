/**
 * Pacientes mostrados na tela inicial do profissional.
 *
 * Os dados vêm do registro do atendimento (#7). Este módulo só ordena, filtra
 * e formata, sem saber onde eles estão guardados.
 */
export type ExamStatus = 'concluido' | 'interrompido' | 'recusado';

export type PatientSummary = {
  id: number;
  name: string;
  /** Número da ficha do paciente na clínica. */
  recordNumber: string;
  /** Data de nascimento no formato AAAA-MM-DD. */
  birthDate: string;
  /** Data e hora ISO do exame mais recente, ou `null` se ainda não houve exame. */
  lastExamAt: string | null;
  lastExamStatus: ExamStatus | null;
  examCount: number;
};

export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  concluido: 'Concluído',
  interrompido: 'Interrompido',
  recusado: 'Recusou o termo',
};

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** O paciente com o exame mais recente vem primeiro; quem não fez exame vai para o fim. */
export function sortByLastExam(patients: readonly PatientSummary[]): PatientSummary[] {
  return [...patients].sort((a, b) => (b.lastExamAt ?? '').localeCompare(a.lastExamAt ?? ''));
}

/** Filtra por parte do nome, sem diferenciar acentos nem maiúsculas, ou pelo número da ficha. */
export function filterPatients(
  patients: readonly PatientSummary[],
  query: string,
): PatientSummary[] {
  const term = normalize(query);
  if (!term) return [...patients];
  return patients.filter(
    (patient) => normalize(patient.name).includes(term) || patient.recordNumber.includes(term),
  );
}

export function countExams(patients: readonly PatientSummary[]): number {
  return patients.reduce((total, patient) => total + patient.examCount, 0);
}

/** Resumo do cabeçalho, por exemplo "8 pacientes e 12 exames aplicados por você." */
export function describeTotals(patients: readonly PatientSummary[]): string {
  if (patients.length === 0) return 'Nenhum exame aplicado ainda.';
  const exams = countExams(patients);
  const pacientes = patients.length === 1 ? '1 paciente' : `${patients.length} pacientes`;
  const exames = exams === 1 ? '1 exame aplicado' : `${exams} exames aplicados`;
  return `${pacientes} e ${exames} por você.`;
}

/** Idade completa na data de referência. */
export function ageOn(birthDate: string, today: Date = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  const currentMonth = today.getMonth() + 1;
  const beforeBirthday = currentMonth < month || (currentMonth === month && today.getDate() < day);
  return today.getFullYear() - year - (beforeBirthday ? 1 : 0);
}

/** Data no formato DD/MM/AAAA, a partir de AAAA-MM-DD ou de data e hora ISO. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}
