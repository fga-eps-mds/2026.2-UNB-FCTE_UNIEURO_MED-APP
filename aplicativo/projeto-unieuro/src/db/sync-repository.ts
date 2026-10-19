import type { SQLiteDatabase } from 'expo-sqlite';

import { formatRecordNumber } from '@/db/attendance-repository';
import { getLocalDeviceId, observeRemoteHlc } from '@/db/change-tracking';
import type { CpfProtector } from '@/db/cpf-protection';
import { cpfProtector } from '@/db/cpf-runtime';
import { getDatabase } from '@/db/database';

/** Último contador recebido de cada tablet. */
export type VersionVector = Record<string, number>;

/** Quem gravou a versão atual, com que contador e quando (HLC). */
type ChangeStamp = { versao_hlc: string; origem_id: string; origem_seq: number };

/**
 * Registros como viajam no pacote, sem o `id` local. O CPF vai em texto dentro do
 * pacote cifrado, porque a cifra do banco só vale no tablet que a gerou.
 */
export type SyncProfessional = ChangeStamp & {
  uuid: string;
  nome: string;
  email: string;
  crm_numero: string;
  uf_crm: string;
  cpf: string;
  senha_hash: string;
  criacao: string;
  last_update: string;
  ativo: number;
};

export type SyncPatient = ChangeStamp & {
  uuid: string;
  nome: string;
  cpf: string;
  /** Ficha no tablet de origem. Quem recebe pode trocar, se já estiver em uso. */
  numero_ficha: string;
  data_nascimento: string;
  escolaridade_anos: number;
  sexo: 'feminino' | 'masculino' | null;
  criacao: string;
  last_update: string;
};

/** Tabela `avaliacao`, com profissional e paciente pelo `uuid`. */
export type SyncAttendance = ChangeStamp & {
  uuid: string;
  profissional_uuid: string;
  paciente_uuid: string;
  data_hora_inicio: string;
  estado: string;
  last_update: string;
};

export type Local<T> = T & { id: number };

export type SyncAlias = { uuid_alias: string; uuid_principal: string };

export type IdentityTable = 'profissional' | 'paciente';

export type ConflictEntry = {
  type: 'versao_perdedora' | 'quarentena';
  table: string;
  recordUuid: string;
  hlc: string | null;
  reason: string;
  data: Record<string, unknown>;
};

export type SyncLogEntry = {
  direction: 'envio' | 'recebimento';
  peerId: string | null;
  startedAt: string;
  finishedAt: string;
  sent?: number;
  received?: number;
  conflicts?: number;
  quarantined?: number;
  result: 'sucesso' | 'recusado' | 'erro';
  reason?: string;
};

const STAMP_COLUMNS = 'versao_hlc, origem_id, origem_seq';

const SELECT_PROFESSIONAL = `SELECT id, uuid, nome, email, crm_numero, uf_crm, cpf_cifrado, senha_hash,
  criacao, last_update, ativo, ${STAMP_COLUMNS} FROM profissional`;

const SELECT_PATIENT = `SELECT id, uuid, nome, cpf_cifrado, numero_ficha, data_nascimento,
  escolaridade_anos, sexo, criacao, last_update, ${STAMP_COLUMNS} FROM paciente`;

const SELECT_ATTENDANCE = `SELECT a.id, a.uuid, p.uuid AS profissional_uuid, pa.uuid AS paciente_uuid,
  a.data_hora_inicio, a.estado, a.last_update, a.versao_hlc, a.origem_id, a.origem_seq
  FROM avaliacao a
  JOIN profissional p ON p.id = a.id_profissional
  JOIN paciente pa ON pa.id = a.id_paciente`;

/** Busca pelo `uuid`, seguindo o alias se houver. */
const byUuid = (table: IdentityTable) =>
  `uuid = coalesce((SELECT uuid_principal FROM ${table}_alias WHERE uuid_alias = ?), ?)`;

// Igual à de `attendance-repository.ts`.
const LAST_RECORD_SEQUENCE = `SELECT COALESCE(MAX(CAST(substr(numero_ficha, 6) AS INTEGER)), 0) AS ultima
  FROM paciente WHERE numero_ficha LIKE ?`;

type ProfessionalRow = Omit<Local<SyncProfessional>, 'cpf'> & { cpf_cifrado: string };
type PatientRow = Omit<Local<SyncPatient>, 'cpf'> & { cpf_cifrado: string };

function syncOperations(database: SQLiteDatabase, protector: CpfProtector) {
  const professionalFromRow = async ({ cpf_cifrado, ...row }: ProfessionalRow) => ({
    ...row,
    cpf: await protector.decrypt(cpf_cifrado),
  });

  const patientFromRow = async ({ cpf_cifrado, ...row }: PatientRow) => ({
    ...row,
    cpf: await protector.decrypt(cpf_cifrado),
  });

  const findProfessional = async (where: string, params: (string | number)[]) => {
    const row = await database.getFirstAsync<ProfessionalRow>(
      `${SELECT_PROFESSIONAL} WHERE ${where} LIMIT 1`,
      params,
    );
    return row ? professionalFromRow(row) : null;
  };

  const findPatient = async (where: string, params: (string | number)[]) => {
    const row = await database.getFirstAsync<PatientRow>(
      `${SELECT_PATIENT} WHERE ${where} LIMIT 1`,
      params,
    );
    return row ? patientFromRow(row) : null;
  };

  const withoutId = <T extends { id: number }>({ id: _id, ...record }: T) => record;

  return {
    getLocalDeviceId: () => getLocalDeviceId(database),

    observeRemoteHlc: (hlc: string, now?: number) => observeRemoteHlc(database, hlc, now),

    /** O que foi recebido de cada tablet mais o que este gravou. */
    async readVector(): Promise<VersionVector> {
      const rows = await database.getAllAsync<{ origem_id: string; seq: number }>(
        `SELECT origem_id, ultimo_seq_recebido AS seq FROM sync_vetor
         UNION ALL
         SELECT c.origem_id, c.ultimo_seq AS seq
           FROM sync_contador c JOIN dispositivo d ON d.id = c.origem_id WHERE d.local = 1`,
      );
      return Object.fromEntries(rows.map((row) => [row.origem_id, row.seq]));
    },

    /** Fica com o maior contador de cada origem. */
    async mergeVector(vector: VersionVector): Promise<void> {
      const localId = await getLocalDeviceId(database);
      for (const [originId, seq] of Object.entries(vector)) {
        if (originId === localId) continue;
        await database.runAsync(
          `INSERT INTO sync_vetor (origem_id, ultimo_seq_recebido) VALUES (?, ?)
           ON CONFLICT (origem_id) DO UPDATE
           SET ultimo_seq_recebido = max(ultimo_seq_recebido, excluded.ultimo_seq_recebido)`,
          [originId, seq],
        );
      }
    },

    // Profissionais

    async listProfessionals(): Promise<SyncProfessional[]> {
      const rows = await database.getAllAsync<ProfessionalRow>(
        `${SELECT_PROFESSIONAL} ORDER BY origem_id, origem_seq`,
      );
      return Promise.all(rows.map(async (row) => withoutId(await professionalFromRow(row))));
    },

    findProfessionalByUuid: (uuid: string) =>
      findProfessional(byUuid('profissional'), [uuid, uuid]),

    findProfessionalByCrm: (crmNumber: string, crmState: string) =>
      findProfessional('crm_numero = ? AND uf_crm = ?', [crmNumber, crmState]),

    findProfessionalByCpf: async (cpf: string) =>
      findProfessional('cpf_indice = ?', [await protector.blindIndex(cpf)]),

    findProfessionalByEmail: (email: string) => findProfessional('email = ?', [email]),

    async insertProfessional(record: SyncProfessional): Promise<void> {
      await database.runAsync(
        `INSERT INTO profissional (uuid, nome, email, crm_numero, uf_crm, cpf_cifrado, cpf_indice,
           senha_hash, criacao, last_update, ativo, ${STAMP_COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.uuid,
          record.nome,
          record.email,
          record.crm_numero,
          record.uf_crm,
          await protector.encrypt(record.cpf),
          await protector.blindIndex(record.cpf),
          record.senha_hash,
          record.criacao,
          record.last_update,
          record.ativo,
          record.versao_hlc,
          record.origem_id,
          record.origem_seq,
        ],
      );
    },

    /** Grava a versão vencedora. A criação fica com a data mais antiga. */
    async updateProfessional(localId: number, record: SyncProfessional): Promise<void> {
      await database.runAsync(
        `UPDATE profissional SET nome = ?, email = ?, senha_hash = ?, ativo = ?, last_update = ?,
           criacao = min(criacao, ?), versao_hlc = ?, origem_id = ?, origem_seq = ?
         WHERE id = ?`,
        [
          record.nome,
          record.email,
          record.senha_hash,
          record.ativo,
          record.last_update,
          record.criacao,
          record.versao_hlc,
          record.origem_id,
          record.origem_seq,
          localId,
        ],
      );
    },

    /** Gravação local: o gatilho dá a marca nova. */
    async deactivateProfessional(localId: number, now: string): Promise<void> {
      await database.runAsync('UPDATE profissional SET ativo = 0, last_update = ? WHERE id = ?', [
        now,
        localId,
      ]);
    },

    // Pacientes

    async listPatients(): Promise<SyncPatient[]> {
      const rows = await database.getAllAsync<PatientRow>(
        `${SELECT_PATIENT} ORDER BY origem_id, origem_seq`,
      );
      return Promise.all(rows.map(async (row) => withoutId(await patientFromRow(row))));
    },

    findPatientByUuid: (uuid: string) => findPatient(byUuid('paciente'), [uuid, uuid]),

    findPatientByCpf: async (cpf: string) =>
      findPatient('cpf_indice = ?', [await protector.blindIndex(cpf)]),

    /** A ficha de origem, se estiver livre aqui; senão, a próxima do ano. */
    async recordNumberFor(incoming: string): Promise<string> {
      const used = await database.getFirstAsync('SELECT 1 FROM paciente WHERE numero_ficha = ?', [
        incoming,
      ]);
      if (!used) return incoming;
      const year = Number(incoming.slice(0, 4));
      const row = await database.getFirstAsync<{ ultima: number }>(LAST_RECORD_SEQUENCE, [
        `${year}-%`,
      ]);
      return formatRecordNumber(year, (row?.ultima ?? 0) + 1);
    },

    async insertPatient(record: SyncPatient, recordNumber: string): Promise<void> {
      await database.runAsync(
        `INSERT INTO paciente (uuid, nome, cpf_cifrado, cpf_indice, numero_ficha, data_nascimento,
           escolaridade_anos, sexo, criacao, last_update, ${STAMP_COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.uuid,
          record.nome,
          await protector.encrypt(record.cpf),
          await protector.blindIndex(record.cpf),
          recordNumber,
          record.data_nascimento,
          record.escolaridade_anos,
          record.sexo,
          record.criacao,
          record.last_update,
          record.versao_hlc,
          record.origem_id,
          record.origem_seq,
        ],
      );
    },

    /** A ficha não muda: é local. */
    async updatePatient(localId: number, record: SyncPatient): Promise<void> {
      await database.runAsync(
        `UPDATE paciente SET nome = ?, data_nascimento = ?, escolaridade_anos = ?, sexo = ?,
           last_update = ?, criacao = min(criacao, ?), versao_hlc = ?, origem_id = ?, origem_seq = ?
         WHERE id = ?`,
        [
          record.nome,
          record.data_nascimento,
          record.escolaridade_anos,
          record.sexo,
          record.last_update,
          record.criacao,
          record.versao_hlc,
          record.origem_id,
          record.origem_seq,
          localId,
        ],
      );
    },

    // Atendimentos

    async listAttendances(): Promise<SyncAttendance[]> {
      const rows = await database.getAllAsync<Local<SyncAttendance>>(
        `${SELECT_ATTENDANCE} ORDER BY a.origem_id, a.origem_seq`,
      );
      return rows.map(withoutId);
    },

    findAttendanceByUuid: (uuid: string) =>
      database.getFirstAsync<Local<SyncAttendance>>(`${SELECT_ATTENDANCE} WHERE a.uuid = ?`, [
        uuid,
      ]),

    async insertAttendance(
      record: SyncAttendance,
      professionalId: number,
      patientId: number,
    ): Promise<void> {
      await database.runAsync(
        `INSERT INTO avaliacao (uuid, id_profissional, id_paciente, data_hora_inicio, estado,
           last_update, ${STAMP_COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.uuid,
          professionalId,
          patientId,
          record.data_hora_inicio,
          record.estado,
          record.last_update,
          record.versao_hlc,
          record.origem_id,
          record.origem_seq,
        ],
      );
    },

    async updateAttendance(
      localId: number,
      record: SyncAttendance,
      professionalId: number,
      patientId: number,
    ): Promise<void> {
      await database.runAsync(
        `UPDATE avaliacao SET id_profissional = ?, id_paciente = ?, data_hora_inicio = ?, estado = ?,
           last_update = ?, versao_hlc = ?, origem_id = ?, origem_seq = ?
         WHERE id = ?`,
        [
          professionalId,
          patientId,
          record.data_hora_inicio,
          record.estado,
          record.last_update,
          record.versao_hlc,
          record.origem_id,
          record.origem_seq,
          localId,
        ],
      );
    },

    // Unificação de cadastros

    /** Gravação local, para a data chegar aos outros tablets. */
    async restampCreation(table: IdentityTable, localId: number, createdAt: string): Promise<void> {
      await database.runAsync(`UPDATE ${table} SET criacao = ? WHERE id = ?`, [createdAt, localId]);
    },

    /** O registro passa a usar `principal`, e os aliases apontam direto para ele. */
    async unify(
      table: IdentityTable,
      localId: number,
      principal: string,
      alias: string,
    ): Promise<void> {
      await database.runAsync(`UPDATE ${table} SET uuid = ? WHERE id = ?`, [principal, localId]);
      await database.runAsync(
        `UPDATE ${table}_alias SET uuid_principal = ? WHERE uuid_principal = ?`,
        [principal, alias],
      );
      await database.runAsync(
        `INSERT OR REPLACE INTO ${table}_alias (uuid_alias, uuid_principal) VALUES (?, ?)`,
        [alias, principal],
      );
    },

    listAliases(table: IdentityTable): Promise<SyncAlias[]> {
      return database.getAllAsync<SyncAlias>(
        `SELECT uuid_alias, uuid_principal FROM ${table}_alias ORDER BY uuid_alias`,
      );
    },

    /**
     * Unificação feita em outro tablet. Vale o menor `uuid`. Se os dois já têm
     * registros separados aqui, não junta: precisa de conferência manual.
     */
    async adoptAlias(
      table: IdentityTable,
      { uuid_alias: alias, uuid_principal: principal }: SyncAlias,
    ): Promise<void> {
      const resolve = async (uuid: string) =>
        (
          await database.getFirstAsync<{ uuid_principal: string }>(
            `SELECT uuid_principal FROM ${table}_alias WHERE uuid_alias = ?`,
            [uuid],
          )
        )?.uuid_principal ?? uuid;

      const first = await resolve(alias);
      const second = await resolve(principal);
      if (first === second) return;

      const [winner, loser] = first < second ? [first, second] : [second, first];
      const rows = await database.getAllAsync<{ id: number }>(
        `SELECT id FROM ${table} WHERE uuid IN (?, ?)`,
        [winner, loser],
      );
      if (rows.length === 2) return;

      await database.runAsync(`UPDATE ${table} SET uuid = ? WHERE uuid = ?`, [winner, loser]);
      await database.runAsync(
        `UPDATE ${table}_alias SET uuid_principal = ? WHERE uuid_principal = ?`,
        [winner, loser],
      );
      await database.runAsync(
        `INSERT OR REPLACE INTO ${table}_alias (uuid_alias, uuid_principal) VALUES (?, ?)`,
        [loser, winner],
      );
    },

    // Controle

    async recordConflict(entry: ConflictEntry, now: string): Promise<void> {
      await database.runAsync(
        `INSERT INTO sync_conflito (tipo, tabela, registro_uuid, versao_hlc, motivo, dados, criacao)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.type,
          entry.table,
          entry.recordUuid,
          entry.hlc,
          entry.reason,
          JSON.stringify(entry.data),
          now,
        ],
      );
    },

    async isDeviceRevoked(deviceId: string): Promise<boolean> {
      const row = await database.getFirstAsync(
        'SELECT 1 FROM dispositivo WHERE id = ? AND revogado_em IS NOT NULL',
        [deviceId],
      );
      return row !== null;
    },

    async registerPeerDevice(deviceId: string, now: string): Promise<void> {
      await database.runAsync(
        'INSERT OR IGNORE INTO dispositivo (id, local, criacao) VALUES (?, 0, ?)',
        [deviceId, now],
      );
    },

    async writeLog(entry: SyncLogEntry): Promise<void> {
      await database.runAsync(
        `INSERT INTO sync_log (direcao, par_id, inicio, fim, enviados, recebidos, conflitos, quarentena,
           resultado, motivo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.direction,
          entry.peerId,
          entry.startedAt,
          entry.finishedAt,
          entry.sent ?? 0,
          entry.received ?? 0,
          entry.conflicts ?? 0,
          entry.quarantined ?? 0,
          entry.result,
          entry.reason ?? null,
        ],
      );
    },

    async lastReceivedAt(): Promise<string | null> {
      const row = await database.getFirstAsync<{ fim: string }>(
        `SELECT fim FROM sync_log WHERE direcao = 'recebimento' AND resultado = 'sucesso'
         ORDER BY fim DESC LIMIT 1`,
      );
      return row?.fim ?? null;
    },
  };
}

export type SyncOperations = ReturnType<typeof syncOperations>;

export function createSyncRepository(
  open: () => Promise<SQLiteDatabase> = getDatabase,
  protector: CpfProtector = cpfProtector,
) {
  return {
    async inTransaction<T>(task: (operations: SyncOperations) => Promise<T>): Promise<T> {
      const database = await open();
      // Carrega a chave antes, para a transação não esperar o Keystore.
      await protector.blindIndex('');
      let result: T | undefined;
      await database.withExclusiveTransactionAsync(async (txn) => {
        result = await task(syncOperations(txn, protector));
      });
      return result as T;
    },

    /** Fora de transação: leituras e log de recusas. */
    async direct(): Promise<SyncOperations> {
      return syncOperations(await open(), protector);
    },
  };
}

export type SyncRepository = ReturnType<typeof createSyncRepository>;
