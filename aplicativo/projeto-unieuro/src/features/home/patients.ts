/**
 * Pacientes mostrados na tela inicial do profissional.
 *
 * Os dados vêm do registro do atendimento (#7). Este módulo converte, ordena,
 * filtra e formata, sem saber onde eles estão guardados.
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
  /**
   * Nome de quem atendeu por último. Só vem na lista do superusuário (#49); na
   * do médico comum, todos os pacientes foram atendidos por ele.
   */
  attendedBy?: string;
  /** Profissionais que já atenderam o paciente. Também só na lista do superusuário. */
  professionalIds?: readonly number[];
  /**
   * Situação do último exame, também quando ele ainda não terminou ("Em
   * andamento"). Sem ela, a lista usa `lastExamStatus`.
   */
  lastExamSituation?: ExamSituation;
};

/** Cor e ícone da situação, como as mensagens do guia de identidade visual. */
export type ExamTone = 'success' | 'warning' | 'error' | 'info';

export const EXAM_STATUS_TONE: Record<ExamStatus, ExamTone> = {
  concluido: 'success',
  interrompido: 'warning',
  recusado: 'warning',
};

export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  concluido: 'Concluído',
  interrompido: 'Interrompido',
  recusado: 'Recusou o termo',
};

/**
 * Paciente atendido, como o repositório do atendimento entrega. Espelha o
 * `AttendedPatientRecord` do banco, que esta camada não importa; a
 * `composition.ts` da feature confere, pelo tipo, que os dois batem.
 */
export type AttendedPatient = {
  id: number;
  name: string;
  recordNumber: string;
  attendanceCount: number;
  lastStartedAt: string;
  lastState: string;
  attendedBy?: string;
  professionalIds?: number[];
};

/** CPF do paciente, só com os dígitos, lido para a busca por CPF (#99). */
export type PatientCpf = {
  patientId: number;
  cpf: string;
};

export type PatientListRepository = {
  listAttendedPatients(professionalId: number): Promise<AttendedPatient[]>;
  listAttendedPatientCpfs(professionalId: number): Promise<PatientCpf[]>;
  /** Pacientes de todos os profissionais. Só respondem a um superusuário (#49). */
  listAllAttendedPatients(requesterId: number): Promise<AttendedPatient[]>;
  listAllAttendedPatientCpfs(requesterId: number): Promise<PatientCpf[]>;
};

/** Quem está pedindo a lista: o profissional da sessão. */
export type PatientListViewer = {
  id: number;
  superuser?: boolean;
};

/**
 * Pacientes que o profissional pode ver: o superusuário vê os de todos, com o
 * nome de quem atendeu, e o médico comum vê só os que ele atendeu (#49).
 */
export function listPatientsFor(
  viewer: PatientListViewer,
  repository: PatientListRepository,
): Promise<AttendedPatient[]> {
  return viewer.superuser === true
    ? repository.listAllAttendedPatients(viewer.id)
    : repository.listAttendedPatients(viewer.id);
}

/** CPF dos pacientes que o profissional pode ver, para a busca por CPF (#99). */
export function listPatientCpfsFor(
  viewer: PatientListViewer,
  repository: PatientListRepository,
): Promise<PatientCpf[]> {
  return viewer.superuser === true
    ? repository.listAllAttendedPatientCpfs(viewer.id)
    : repository.listAttendedPatientCpfs(viewer.id);
}

/** Texto e tom da situação de um exame, terminado ou não. */
export type ExamSituation = { label: string; tone: ExamTone };

// Situação dos exames que ainda não terminaram. Os que terminaram usam o rótulo
// de `EXAM_STATUS_LABEL`, para a mesma situação ter sempre o mesmo texto.
export const UNFINISHED_EXAM_LABEL: Record<string, string> = {
  aguardando_consentimento: 'Aguardando o termo',
  em_andamento: 'Em andamento',
  processando_resultado: 'Processando',
  erro_inferencia: 'Erro ao calcular',
};

export const UNKNOWN_EXAM_LABEL = 'Situação desconhecida';

// Estados da avaliação que encerram o exame, conforme o diagrama de estados do
// documento de arquitetura. Os demais (aguardando consentimento, em andamento,
// processando resultado e erro na inferência) ainda não terminaram e ficam sem
// rótulo na lista.
const FINISHED_STATES: Record<string, ExamStatus> = {
  concluida: 'concluido',
  interrompida: 'interrompido',
  cancelada: 'recusado',
};

export function toExamStatus(state: string): ExamStatus | null {
  return FINISHED_STATES[state] ?? null;
}

/**
 * Situação de um exame pelo estado gravado. O erro ao calcular é o único exame
 * não terminado que pede ação; os demais só informam em que ponto o exame está.
 */
export function describeExamState(state: string): ExamSituation {
  const status = toExamStatus(state);
  if (status) return { label: EXAM_STATUS_LABEL[status], tone: EXAM_STATUS_TONE[status] };
  return {
    label: UNFINISHED_EXAM_LABEL[state] ?? UNKNOWN_EXAM_LABEL,
    tone: state === 'erro_inferencia' ? 'error' : 'info',
  };
}

/** Cada atendimento registrado conta como um exame do paciente com esse profissional. */
export function toPatientSummary(patient: AttendedPatient): PatientSummary {
  return {
    id: patient.id,
    name: patient.name,
    recordNumber: patient.recordNumber,
    lastExamAt: patient.lastStartedAt,
    lastExamStatus: toExamStatus(patient.lastState),
    examCount: patient.attendanceCount,
    lastExamSituation: describeExamState(patient.lastState),
    ...(patient.attendedBy === undefined ? {} : { attendedBy: patient.attendedBy }),
    ...(patient.professionalIds === undefined ? {} : { professionalIds: patient.professionalIds }),
  };
}

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

const CPF_QUERY = /^[\d.\-\s]+$/;

/**
 * Dígitos de CPF digitados na busca, com ou sem pontuação, ou `null` quando o
 * texto tem letras e não pode ser um CPF.
 */
export function cpfDigitsOf(query: string): string | null {
  const trimmed = query.trim();
  if (!CPF_QUERY.test(trimmed)) return null;
  return trimmed.replace(/\D/g, '') || null;
}

/**
 * Filtra por parte do nome, sem diferenciar acentos nem maiúsculas, pelo número
 * da ficha ou pelos primeiros dígitos do CPF. O CPF é comparado pelo começo, e
 * não por qualquer trecho, como a equipe combinou na #99. Na lista do
 * superusuário, também pelo nome de quem atendeu (#49).
 */
export function filterPatients(
  patients: readonly PatientSummary[],
  query: string,
  cpfs: ReadonlyMap<number, string> = new Map(),
): PatientSummary[] {
  const term = normalize(query);
  if (!term) return [...patients];
  const cpfDigits = cpfDigitsOf(query);
  const matchesCpf = (patient: PatientSummary) =>
    cpfDigits !== null && (cpfs.get(patient.id)?.startsWith(cpfDigits) ?? false);
  return patients.filter(
    (patient) =>
      normalize(patient.name).includes(term) ||
      normalize(patient.recordNumber).includes(term) ||
      (patient.attendedBy !== undefined && normalize(patient.attendedBy).includes(term)) ||
      matchesCpf(patient),
  );
}

export function countExams(patients: readonly PatientSummary[]): number {
  return patients.reduce((total, patient) => total + patient.examCount, 0);
}

/** Quantos profissionais diferentes atenderam os pacientes da lista. */
export function countProfessionals(patients: readonly PatientSummary[]): number {
  return new Set(patients.flatMap((patient) => patient.professionalIds ?? [])).size;
}

const ONLY_SUPERUSER_SEES = 'Só o responsável pela pesquisa vê esta lista.';

/**
 * Resumo do cabeçalho, por exemplo "8 pacientes e 12 exames aplicados por você."
 * Para o superusuário, que vê a lista de todos os profissionais (#49), os exames
 * são do tablet, e o resumo lembra que só ele vê a lista, como no protótipo.
 */
export function describeTotals(
  patients: readonly PatientSummary[],
  allProfessionals = false,
): string {
  if (patients.length === 0) return 'Nenhum exame aplicado ainda.';
  const exams = countExams(patients);
  const pacientes = patients.length === 1 ? '1 paciente' : `${patients.length} pacientes`;
  if (allProfessionals) {
    const doTablet = exams === 1 ? '1 exame' : `${exams} exames`;
    const count = countProfessionals(patients);
    const deQuem =
      count === 0 ? '' : count === 1 ? ' de 1 profissional' : ` de ${count} profissionais`;
    return `${pacientes} e ${doTablet}${deQuem} deste tablet. ${ONLY_SUPERUSER_SEES}`;
  }
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
