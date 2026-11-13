import { isBase64 } from '@/db/base64';
import { parseHlc } from '@/db/hlc';
import { FINAL_ATTENDANCE_STATES } from '@/db/sync-migration';
import type {
  FinalAttendanceState,
  SyncAlias,
  SyncAttendance,
  SyncConsent,
  SyncPatient,
  SyncProfessional,
  SyncTask,
  SyncTraceEvent,
  VersionVector,
} from '@/db/sync-repository';

// Formato do pacote trocado entre tablets. Não é o XML da pesquisa.
export const PACKAGE_FORMAT = 'med-sync';
export const PACKAGE_VERSION = 1;

export type SyncPackage = {
  formato: typeof PACKAGE_FORMAT;
  versao_pacote: typeof PACKAGE_VERSION;
  /** `PRAGMA user_version` de quem gerou. Precisa ser igual nos dois tablets. */
  versao_esquema: number;
  origem: string;
  gerado_em: string;
  /** O que o tablet de origem já tinha de cada tablet. */
  vetor: VersionVector;
  /** Validados um a um na importação. */
  profissionais: unknown[];
  pacientes: unknown[];
  avaliacoes: unknown[];
  /** Vão sempre inteiros: trocar o uuid não gera versão nova. */
  aliases_profissional: SyncAlias[];
  aliases_paciente: SyncAlias[];
};

export type RefusalReason =
  | 'arquivo_invalido'
  | 'codigo_incorreto'
  | 'versao_incompativel'
  | 'mesmo_tablet'
  | 'tablet_revogado';

/** Nada do pacote é gravado. */
export class PackageRefusedError extends Error {
  constructor(readonly reason: RefusalReason) {
    super(`Pacote recusado: ${reason}`);
    this.name = 'PackageRefusedError';
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CPF_PATTERN = /^\d{11}$/;
const CRM_PATTERN = /^\d+$/;
const STATE_PATTERN = /^[A-Z]{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RECORD_NUMBER_PATTERN = /^\d{4}-\d+$/;
const SEXES = ['feminino', 'masculino'];
// Só os estados finais viajam: os outros ainda podem mudar no tablet de origem.
const ATTENDANCE_STATES: readonly string[] = FINAL_ATTENDANCE_STATES;
const SIGNERS = ['paciente', 'responsavel_legal'];
// Mesmas regras dos CHECK das tabelas `tarefa` e `evento_tracado`.
const TASK_ORDER: Record<string, number> = { relogio: 1, cubo: 2, trilhas: 3 };
const POINT_EVENTS = ['inicio', 'ponto'];
const ACTION_EVENTS = ['desfazer', 'limpar'];
const POINTERS = ['caneta', 'dedo', 'mouse', 'desconhecido'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isFilled = (value: unknown): value is string => isText(value) && value.trim().length > 0;
const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isFlag = (value: unknown): value is number => value === 0 || value === 1;
const isOptionalFlag = (value: unknown) => value === null || isFlag(value);
const isOptionalNumber = (value: unknown) => value === null || isNumber(value);
const isOptionalFilled = (value: unknown) => value === null || isFilled(value);
const matches = (value: unknown, pattern: RegExp): value is string =>
  isText(value) && pattern.test(value);

export const isUuid = (value: unknown): value is string => matches(value, UUID_PATTERN);

export function isCovered(vector: VersionVector, originId: string, originSeq: number): boolean {
  return (vector[originId] ?? 0) >= originSeq;
}

type Stamped = { origem_id: string; origem_seq: number };

/** Sem `peerVector` leva tudo (arquivo); com ele, só a diferença (Nearby). */
export function buildPackage(input: {
  origin: string;
  schemaVersion: number;
  generatedAt: string;
  vector: VersionVector;
  professionals: SyncProfessional[];
  patients: SyncPatient[];
  attendances: SyncAttendance[];
  professionalAliases: SyncAlias[];
  patientAliases: SyncAlias[];
  peerVector?: VersionVector;
}): SyncPackage {
  const { peerVector } = input;
  const missing = <T extends Stamped>(records: T[]) =>
    peerVector
      ? records.filter((record) => !isCovered(peerVector, record.origem_id, record.origem_seq))
      : records;

  return {
    formato: PACKAGE_FORMAT,
    versao_pacote: PACKAGE_VERSION,
    versao_esquema: input.schemaVersion,
    origem: input.origin,
    gerado_em: input.generatedAt,
    vetor: input.vector,
    profissionais: missing(input.professionals),
    pacientes: missing(input.patients),
    avaliacoes: missing(input.attendances),
    aliases_profissional: input.professionalAliases,
    aliases_paciente: input.patientAliases,
  };
}

export const countRecords = (syncPackage: SyncPackage) =>
  syncPackage.profissionais.length + syncPackage.pacientes.length + syncPackage.avaliacoes.length;

function isAliasList(value: unknown): value is SyncAlias[] {
  return (
    Array.isArray(value) &&
    value.every(
      (alias) => isObject(alias) && isUuid(alias.uuid_alias) && isUuid(alias.uuid_principal),
    )
  );
}

export function isVector(value: unknown): value is VersionVector {
  return (
    isObject(value) && Object.entries(value).every(([key, seq]) => isUuid(key) && isCount(seq))
  );
}

/** Confere só o cabeçalho. Os registros são validados depois. */
export function parsePackage(json: string, expectedSchemaVersion: number): SyncPackage {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new PackageRefusedError('arquivo_invalido');
  }

  if (
    !isObject(value) ||
    value.formato !== PACKAGE_FORMAT ||
    value.versao_pacote !== PACKAGE_VERSION ||
    !isUuid(value.origem) ||
    !isText(value.gerado_em) ||
    !isVector(value.vetor) ||
    !Array.isArray(value.profissionais) ||
    !Array.isArray(value.pacientes) ||
    !Array.isArray(value.avaliacoes) ||
    !isAliasList(value.aliases_profissional) ||
    !isAliasList(value.aliases_paciente)
  ) {
    throw new PackageRefusedError('arquivo_invalido');
  }
  if (value.versao_esquema !== expectedSchemaVersion) {
    throw new PackageRefusedError('versao_incompativel');
  }
  return value as SyncPackage;
}

function hasStamp(value: Record<string, unknown>): boolean {
  return (
    isText(value.versao_hlc) &&
    parseHlc(value.versao_hlc) !== null &&
    isUuid(value.origem_id) &&
    isCount(value.origem_seq) &&
    value.origem_seq > 0
  );
}

/** Mesmas regras dos CHECK da tabela. `null` se for inválido. */
export function validateProfessional(value: unknown): SyncProfessional | null {
  if (!isObject(value)) return null;
  const valid =
    isUuid(value.uuid) &&
    isFilled(value.nome) &&
    matches(value.email, EMAIL_PATTERN) &&
    matches(value.crm_numero, CRM_PATTERN) &&
    matches(value.uf_crm, STATE_PATTERN) &&
    matches(value.cpf, CPF_PATTERN) &&
    isFilled(value.senha_hash) &&
    isText(value.criacao) &&
    isText(value.last_update) &&
    (value.ativo === 0 || value.ativo === 1) &&
    (value.desativacao === null || isFilled(value.desativacao)) &&
    hasStamp(value);
  if (!valid) return null;

  return {
    uuid: value.uuid as string,
    nome: value.nome as string,
    email: value.email as string,
    crm_numero: value.crm_numero as string,
    uf_crm: value.uf_crm as string,
    cpf: value.cpf as string,
    senha_hash: value.senha_hash as string,
    criacao: value.criacao as string,
    last_update: value.last_update as string,
    ativo: value.ativo as number,
    desativacao: value.desativacao as string | null,
    versao_hlc: value.versao_hlc as string,
    origem_id: value.origem_id as string,
    origem_seq: value.origem_seq as number,
  };
}

export function validatePatient(value: unknown): SyncPatient | null {
  if (!isObject(value)) return null;
  const valid =
    isUuid(value.uuid) &&
    isFilled(value.nome) &&
    matches(value.cpf, CPF_PATTERN) &&
    matches(value.numero_ficha, RECORD_NUMBER_PATTERN) &&
    matches(value.data_nascimento, DATE_PATTERN) &&
    isCount(value.escolaridade_anos) &&
    (value.sexo === null || SEXES.includes(value.sexo as string)) &&
    isText(value.criacao) &&
    isText(value.last_update) &&
    isFlag(value.ativo) &&
    isOptionalFilled(value.exclusao) &&
    hasStamp(value);
  if (!valid) return null;

  return {
    uuid: value.uuid as string,
    nome: value.nome as string,
    cpf: value.cpf as string,
    numero_ficha: value.numero_ficha as string,
    data_nascimento: value.data_nascimento as string,
    escolaridade_anos: value.escolaridade_anos as number,
    sexo: value.sexo as SyncPatient['sexo'],
    criacao: value.criacao as string,
    last_update: value.last_update as string,
    ativo: value.ativo as number,
    exclusao: value.exclusao as string | null,
    versao_hlc: value.versao_hlc as string,
    origem_id: value.origem_id as string,
    origem_seq: value.origem_seq as number,
  };
}

/** Mesmas regras do CHECK da tabela `consentimento`. */
function validateConsent(value: unknown): SyncConsent | null {
  if (!isObject(value)) return null;
  const accepted = value.aceito === 1;
  const valid =
    isFilled(value.versao_tcle) &&
    isFlag(value.aceito) &&
    SIGNERS.includes(value.assinado_por as string) &&
    (accepted ? isBase64(value.assinatura_png) : value.assinatura_png === null) &&
    isFilled(value.data_hora) &&
    isOptionalFlag(value.autoriza_imagens_pesquisa) &&
    isOptionalFlag(value.autoriza_dados_pesquisa_futura) &&
    (value.cpf_responsavel === null ||
      (accepted &&
        value.assinado_por === 'responsavel_legal' &&
        matches(value.cpf_responsavel, CPF_PATTERN)));
  if (!valid) return null;

  return {
    versao_tcle: value.versao_tcle as string,
    aceito: value.aceito as number,
    assinado_por: value.assinado_por as string,
    assinatura_png: value.assinatura_png as string | null,
    data_hora: value.data_hora as string,
    autoriza_imagens_pesquisa: value.autoriza_imagens_pesquisa as number | null,
    autoriza_dados_pesquisa_futura: value.autoriza_dados_pesquisa_futura as number | null,
    cpf_responsavel: value.cpf_responsavel as string | null,
  };
}

/** Ponto e início têm posição e ponteiro; desfazer e limpar não têm nada disso. */
function isTraceEvent(value: unknown): value is SyncTraceEvent {
  if (!Array.isArray(value) || value.length !== 9) return false;
  const [ordem, tipo, ponteiro, x, y, instante, pressao, inclinacaoX, inclinacaoY] = value;
  const common = isCount(ordem) && ordem >= 1 && isCount(instante);
  if (POINT_EVENTS.includes(tipo)) {
    return (
      common &&
      POINTERS.includes(ponteiro) &&
      isNumber(x) &&
      isNumber(y) &&
      (pressao === null || (isNumber(pressao) && pressao >= 0)) &&
      isOptionalNumber(inclinacaoX) &&
      isOptionalNumber(inclinacaoY)
    );
  }
  return (
    common &&
    ACTION_EVENTS.includes(tipo) &&
    [ponteiro, x, y, pressao, inclinacaoX, inclinacaoY].every((field) => field === null)
  );
}

const increasing = (orders: number[]) =>
  orders.every((order, i) => i === 0 || order > orders[i - 1]);

function validateTask(value: unknown): SyncTask | null {
  if (!isObject(value)) return null;
  const drawing = value.desenho;
  const validDrawing =
    drawing === null ||
    (isObject(drawing) &&
      isBase64(drawing.imagem_final) &&
      isFilled(drawing.data_hora_confirmacao));
  const valid =
    TASK_ORDER[value.tipo as string] !== undefined &&
    TASK_ORDER[value.tipo as string] === value.ordem &&
    isNumber(value.largura) &&
    value.largura > 0 &&
    isNumber(value.altura) &&
    value.altura > 0 &&
    isFilled(value.data_hora_inicio) &&
    isOptionalFilled(value.data_hora_termino) &&
    validDrawing &&
    Array.isArray(value.eventos) &&
    value.eventos.every(isTraceEvent) &&
    increasing(value.eventos.map((event: SyncTraceEvent) => event[0]));
  if (!valid) return null;

  const desenho = drawing as Record<string, unknown> | null;
  return {
    tipo: value.tipo as string,
    ordem: value.ordem as number,
    largura: value.largura as number,
    altura: value.altura as number,
    data_hora_inicio: value.data_hora_inicio as string,
    data_hora_termino: value.data_hora_termino as string | null,
    desenho: desenho
      ? {
          imagem_final: desenho.imagem_final as string,
          data_hora_confirmacao: desenho.data_hora_confirmacao as string,
        }
      : null,
    eventos: (value.eventos as SyncTraceEvent[]).map((event) => [...event] as SyncTraceEvent),
  };
}

/**
 * A avaliação só vale inteira: se o consentimento ou qualquer tarefa for
 * inválido, ela toda é recusada.
 */
export function validateAttendance(value: unknown): SyncAttendance | null {
  if (!isObject(value)) return null;
  const consent = value.consentimento === null ? null : validateConsent(value.consentimento);
  const tasks = Array.isArray(value.tarefas) ? value.tarefas.map(validateTask) : null;
  const valid =
    isUuid(value.uuid) &&
    isUuid(value.profissional_uuid) &&
    isUuid(value.paciente_uuid) &&
    isFilled(value.data_hora_inicio) &&
    ATTENDANCE_STATES.includes(value.estado as string) &&
    isFlag(value.ativo) &&
    isOptionalFilled(value.exclusao) &&
    isText(value.last_update) &&
    (value.consentimento === null || consent !== null) &&
    tasks !== null &&
    tasks.every((task) => task !== null) &&
    increasing(tasks.map((task) => task!.ordem)) &&
    hasStamp(value);
  if (!valid) return null;

  return {
    uuid: value.uuid as string,
    profissional_uuid: value.profissional_uuid as string,
    paciente_uuid: value.paciente_uuid as string,
    data_hora_inicio: value.data_hora_inicio as string,
    estado: value.estado as FinalAttendanceState,
    ativo: value.ativo as number,
    exclusao: value.exclusao as string | null,
    last_update: value.last_update as string,
    consentimento: consent,
    tarefas: tasks as SyncTask[],
    versao_hlc: value.versao_hlc as string,
    origem_id: value.origem_id as string,
    origem_seq: value.origem_seq as number,
  };
}
