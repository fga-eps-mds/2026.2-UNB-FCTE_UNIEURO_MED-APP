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

// Compara instantes, e não textos: "2026-10-05T23:30:00Z" e
// "2026-10-05T20:30:00-03:00" são o mesmo momento escrito de formas diferentes.
const examTime = (patient: PatientSummary) =>
  patient.lastExamAt ? Date.parse(patient.lastExamAt) : Number.NEGATIVE_INFINITY;

/** O paciente com o exame mais recente vem primeiro; quem não fez exame vai para o fim. */
export function sortByLastExam(patients: readonly PatientSummary[]): PatientSummary[] {
  return [...patients].sort((a, b) => {
    const [timeA, timeB] = [examTime(a), examTime(b)];
    if (timeA === timeB) return 0;
    return timeB > timeA ? 1 : -1;
  });
}

/** Filtra por parte do nome, sem diferenciar acentos nem maiúsculas, ou pelo número da ficha. */
export function filterPatients(
  patients: readonly PatientSummary[],
  query: string,
): PatientSummary[] {
  const term = normalize(query);
  if (!term) return [...patients];
  return patients.filter(
    (patient) =>
      normalize(patient.name).includes(term) || normalize(patient.recordNumber).includes(term),
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

const twoDigits = (value: number) => String(value).padStart(2, '0');

/**
 * Data no formato DD/MM/AAAA, no horário do tablet.
 *
 * Uma data sem hora (AAAA-MM-DD) é mostrada como está. Uma data com hora é
 * convertida para o fuso do aparelho antes: um exame gravado com
 * `toISOString()` às 22h em Brasília fica com o dia seguinte em UTC, e cortar o
 * texto mostraria a data errada.
 */
export function formatDate(isoDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(isoDate);
  return `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${date.getFullYear()}`;
}
