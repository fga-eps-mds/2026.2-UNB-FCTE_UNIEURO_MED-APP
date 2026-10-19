import { compareHlc } from '@/db/hlc';
import type {
  IdentityTable,
  Local,
  SyncAttendance,
  SyncOperations,
  SyncPatient,
  SyncProfessional,
  VersionVector,
} from '@/db/sync-repository';
import {
  isCovered,
  validateAttendance,
  validatePatient,
  validateProfessional,
  type SyncPackage,
} from '@/features/sincronizacao/sync-package';

type Counts = { inserted: number; updated: number };

export type ImportSummary = {
  professionals: Counts & { unified: number };
  patients: Counts & { unified: number };
  attendances: Counts;
  /** Edições concorrentes. A perdedora fica em `sync_conflito`. */
  conflicts: number;
  /** Registros recusados um a um. */
  quarantined: number;
  /** Já recebidos antes. */
  skipped: number;
};

export const emptySummary = (): ImportSummary => ({
  professionals: { inserted: 0, updated: 0, unified: 0 },
  patients: { inserted: 0, updated: 0, unified: 0 },
  attendances: { inserted: 0, updated: 0 },
  conflicts: 0,
  quarantined: 0,
  skipped: 0,
});

export const receivedCount = ({ professionals, patients, attendances }: ImportSummary) =>
  professionals.inserted +
  professionals.updated +
  patients.inserted +
  patients.updated +
  attendances.inserted +
  attendances.updated;

type Context = {
  operations: SyncOperations;
  senderVector: VersionVector;
  now: Date;
  summary: ImportSummary;
};

type Versioned = { uuid: string; versao_hlc: string; origem_id: string; origem_seq: number };

/**
 * `losingData`: o que se guarda da versão perdedora. Nunca CPF, hash de senha ou
 * dado que identifique o paciente.
 */
type Spec<T extends Versioned> = {
  table: string;
  fields: readonly (keyof T)[];
  losingData: (record: T) => Record<string, unknown>;
};

const origin = (record: Partial<Versioned>) => ({
  origem_id: record.origem_id ?? null,
  origem_seq: record.origem_seq ?? null,
});

const PROFESSIONAL: Spec<SyncProfessional> = {
  table: 'profissional',
  fields: ['nome', 'email', 'senha_hash', 'ativo'],
  losingData: (record) => ({
    nome: record.nome,
    email: record.email,
    ativo: record.ativo,
    last_update: record.last_update,
    ...origin(record),
  }),
};

const PATIENT: Spec<SyncPatient> = {
  table: 'paciente',
  fields: ['nome', 'data_nascimento', 'escolaridade_anos', 'sexo'],
  losingData: (record) => ({ last_update: record.last_update, ...origin(record) }),
};

const ATTENDANCE: Spec<SyncAttendance> = {
  table: 'avaliacao',
  fields: ['profissional_uuid', 'paciente_uuid', 'data_hora_inicio', 'estado'],
  losingData: (record) => ({
    estado: record.estado,
    last_update: record.last_update,
    ...origin(record),
  }),
};

const sameContent = <T extends Versioned>(spec: Spec<T>, a: T, b: T) =>
  spec.fields.every((field) => a[field] === b[field]);

// Recusa só este registro. Guarda ids técnicos e, do profissional, o CRM.
async function quarantine(context: Context, table: string, value: unknown, reason: string) {
  const record = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  > &
    Partial<Versioned>;
  const professionalData =
    table === PROFESSIONAL.table
      ? { crm_numero: record.crm_numero ?? null, uf_crm: record.uf_crm ?? null }
      : {};

  await context.operations.recordConflict(
    {
      type: 'quarentena',
      table,
      recordUuid: typeof record.uuid === 'string' ? record.uuid : 'desconhecido',
      hlc: typeof record.versao_hlc === 'string' ? record.versao_hlc : null,
      reason,
      data: { ...professionalData, ...origin(record) },
    },
    context.now.toISOString(),
  );
  context.summary.quarantined += 1;
}

/**
 * Vence o maior HLC. Só é conflito se as duas versões mudaram sem uma ter visto a
 * outra.
 */
async function newestVersion<T extends Versioned>(
  context: Context,
  spec: Spec<T>,
  local: Local<T>,
  incoming: T,
): Promise<'local' | 'incoming' | 'equal'> {
  const order = compareHlc(incoming.versao_hlc, local.versao_hlc);
  if (order === 0) return 'equal';

  const record = async (loser: T) => {
    await context.operations.recordConflict(
      {
        type: 'versao_perdedora',
        table: spec.table,
        recordUuid: local.uuid,
        hlc: loser.versao_hlc,
        reason: 'edicao_concorrente',
        data: spec.losingData(loser),
      },
      context.now.toISOString(),
    );
    context.summary.conflicts += 1;
  };

  if (order < 0) {
    if (!sameContent(spec, local, incoming)) await record(incoming);
    return 'local';
  }

  const concurrent =
    !isCovered(context.senderVector, local.origem_id, local.origem_seq) &&
    !sameContent(spec, local, incoming);
  if (concurrent) await record(local);
  return 'incoming';
}

// Mesmo cadastro com uuid diferente em cada tablet: fica o menor.
async function unify<T extends Versioned & { criacao: string }>(
  context: Context,
  table: IdentityTable,
  local: Local<T>,
  incoming: T,
): Promise<Local<T>> {
  const [principal, alias] =
    incoming.uuid < local.uuid ? [incoming.uuid, local.uuid] : [local.uuid, incoming.uuid];
  await context.operations.unify(table, local.id, principal, alias);
  return { ...local, uuid: principal };
}

/**
 * Fica a criação mais antiga. Se ela não é a da versão vencedora, vira gravação
 * local para chegar ao outro tablet.
 */
async function keepEarliestCreation<T extends Versioned & { criacao: string }>(
  context: Context,
  table: IdentityTable,
  local: Local<T>,
  incoming: T,
) {
  const winner = compareHlc(incoming.versao_hlc, local.versao_hlc) > 0 ? incoming : local;
  const earliest = incoming.criacao < local.criacao ? incoming.criacao : local.criacao;
  if (earliest === winner.criacao) return;
  await context.operations.observeRemoteHlc(incoming.versao_hlc, context.now.getTime());
  await context.operations.restampCreation(table, local.id, earliest);
}

// Profissional

/**
 * Vence a versão mais recente, mas a desativação vence sempre. Senão, uma troca
 * de senha feita em outro tablet reativaria a conta.
 */
async function applyProfessionalVersion(
  context: Context,
  local: Local<SyncProfessional>,
  incoming: SyncProfessional,
) {
  const { operations, summary } = context;

  const incomingIsNewer = compareHlc(incoming.versao_hlc, local.versao_hlc) > 0;
  if (incomingIsNewer && incoming.email.toLowerCase() !== local.email.toLowerCase()) {
    const owner = await operations.findProfessionalByEmail(incoming.email);
    if (owner && owner.id !== local.id) {
      await quarantine(context, PROFESSIONAL.table, incoming, 'email_em_uso');
      return;
    }
  }

  const winner = await newestVersion(context, PROFESSIONAL, local, incoming);
  if (winner === 'incoming') {
    await operations.updateProfessional(local.id, incoming);
    summary.professionals.updated += 1;
  }

  const resultActive = winner === 'incoming' ? incoming.ativo : local.ativo;
  const deactivatedSomewhere = local.ativo === 0 || incoming.ativo === 0;
  if (deactivatedSomewhere && resultActive === 1) {
    await operations.observeRemoteHlc(incoming.versao_hlc, context.now.getTime());
    await operations.deactivateProfessional(local.id, context.now.toISOString());
    if (winner !== 'incoming') summary.professionals.updated += 1;
  }
}

/**
 * uuid desconhecido. Mesmo CRM + UF e mesmo CPF, sem outro cadastro em conflito,
 * é a mesma pessoa. Qualquer outra coincidência vai para a quarentena.
 */
async function applyUnknownProfessional(context: Context, incoming: SyncProfessional) {
  const { operations, summary } = context;
  const byCrm = await operations.findProfessionalByCrm(incoming.crm_numero, incoming.uf_crm);
  const byCpf = await operations.findProfessionalByCpf(incoming.cpf);
  const byEmail = await operations.findProfessionalByEmail(incoming.email);
  const matches = new Set(
    [byCrm, byCpf, byEmail].filter((match) => match !== null).map((match) => match.id),
  );

  if (matches.size === 0) {
    await operations.insertProfessional(incoming);
    summary.professionals.inserted += 1;
    return;
  }
  if (!byCrm || matches.size > 1 || byCrm.cpf !== incoming.cpf) {
    await quarantine(context, PROFESSIONAL.table, incoming, 'identidade_ambigua');
    return;
  }

  const local = await unify(context, 'profissional', byCrm, incoming);
  summary.professionals.unified += 1;
  await applyProfessionalVersion(context, local, incoming);
  await keepEarliestCreation(context, 'profissional', local, incoming);
}

async function applyProfessional(context: Context, incoming: SyncProfessional) {
  const local = await context.operations.findProfessionalByUuid(incoming.uuid);
  if (!local) {
    await applyUnknownProfessional(context, incoming);
    return;
  }

  const sameIdentity =
    local.crm_numero === incoming.crm_numero &&
    local.uf_crm === incoming.uf_crm &&
    local.cpf === incoming.cpf;
  if (!sameIdentity) {
    await quarantine(context, PROFESSIONAL.table, incoming, 'identidade_divergente');
    return;
  }
  await applyProfessionalVersion(context, local, incoming);
}

// Paciente

async function applyPatientVersion(
  context: Context,
  local: Local<SyncPatient>,
  incoming: SyncPatient,
) {
  if ((await newestVersion(context, PATIENT, local, incoming)) !== 'incoming') return;
  await context.operations.updatePatient(local.id, incoming);
  context.summary.patients.updated += 1;
}

/**
 * uuid desconhecido. Mesmo CPF é o mesmo paciente, e cada tablet mantém a sua
 * ficha. Paciente novo ganha outra ficha se a de origem já estiver em uso.
 */
async function applyUnknownPatient(context: Context, incoming: SyncPatient) {
  const { operations, summary } = context;
  const byCpf = await operations.findPatientByCpf(incoming.cpf);

  if (!byCpf) {
    const recordNumber = await operations.recordNumberFor(incoming.numero_ficha);
    await operations.insertPatient(incoming, recordNumber);
    summary.patients.inserted += 1;
    return;
  }

  const local = await unify(context, 'paciente', byCpf, incoming);
  summary.patients.unified += 1;
  await applyPatientVersion(context, local, incoming);
  await keepEarliestCreation(context, 'paciente', local, incoming);
}

async function applyPatient(context: Context, incoming: SyncPatient) {
  const local = await context.operations.findPatientByUuid(incoming.uuid);
  if (!local) {
    await applyUnknownPatient(context, incoming);
    return;
  }
  if (local.cpf !== incoming.cpf) {
    await quarantine(context, PATIENT.table, incoming, 'identidade_divergente');
    return;
  }
  await applyPatientVersion(context, local, incoming);
}

// Atendimento

/**
 * Profissional e paciente vêm pelo uuid. Se algum não existir aqui, o atendimento
 * vai para a quarentena.
 */
async function applyAttendance(context: Context, received: SyncAttendance) {
  const { operations, summary } = context;
  const professional = await operations.findProfessionalByUuid(received.profissional_uuid);
  const patient = await operations.findPatientByUuid(received.paciente_uuid);
  if (!professional || !patient) {
    await quarantine(context, ATTENDANCE.table, received, 'referencia_desconhecida');
    return;
  }

  const incoming = {
    ...received,
    profissional_uuid: professional.uuid,
    paciente_uuid: patient.uuid,
  };
  const local = await operations.findAttendanceByUuid(incoming.uuid);
  if (!local) {
    await operations.insertAttendance(incoming, professional.id, patient.id);
    summary.attendances.inserted += 1;
    return;
  }

  if ((await newestVersion(context, ATTENDANCE, local, incoming)) !== 'incoming') return;
  await operations.updateAttendance(local.id, incoming, professional.id, patient.id);
  summary.attendances.updated += 1;
}

/**
 * Rode dentro de `SyncRepository.inTransaction`. Importar o mesmo pacote duas
 * vezes não muda nada. Atendimentos por último, porque apontam para os outros.
 */
export async function applyPackage(
  operations: SyncOperations,
  syncPackage: SyncPackage,
  now: Date,
): Promise<ImportSummary> {
  const summary = emptySummary();
  const context: Context = { operations, senderVector: syncPackage.vetor, now, summary };

  await operations.registerPeerDevice(syncPackage.origem, now.toISOString());
  for (const alias of syncPackage.aliases_profissional) {
    await operations.adoptAlias('profissional', alias);
  }
  for (const alias of syncPackage.aliases_paciente) await operations.adoptAlias('paciente', alias);

  const localVector = await operations.readVector();
  const received: VersionVector = { ...syncPackage.vetor };
  let newestHlc = '';

  async function applyAll<T extends Versioned>(
    table: string,
    values: unknown[],
    validate: (value: unknown) => T | null,
    apply: (context: Context, record: T) => Promise<void>,
  ) {
    for (const value of values) {
      const record = validate(value);
      if (!record) {
        await quarantine(context, table, value, 'registro_invalido');
        continue;
      }

      if (isCovered(localVector, record.origem_id, record.origem_seq)) {
        summary.skipped += 1;
      } else {
        await apply(context, record);
      }
      received[record.origem_id] = Math.max(received[record.origem_id] ?? 0, record.origem_seq);
      if (compareHlc(record.versao_hlc, newestHlc) > 0) newestHlc = record.versao_hlc;
    }
  }

  await applyAll(
    PROFESSIONAL.table,
    syncPackage.profissionais,
    validateProfessional,
    applyProfessional,
  );
  await applyAll(PATIENT.table, syncPackage.pacientes, validatePatient, applyPatient);
  await applyAll(ATTENDANCE.table, syncPackage.avaliacoes, validateAttendance, applyAttendance);

  await operations.mergeVector(received);
  if (newestHlc) await operations.observeRemoteHlc(newestHlc, now.getTime());
  return summary;
}
