import { getRandomBytesAsync } from 'expo-crypto';

import { SCHEMA_VERSION } from '@/db/schema';
import {
  createSyncRepository,
  type SyncRepository,
  type VersionVector,
} from '@/db/sync-repository';
import {
  applyPackage,
  emptySummary,
  mergeSummaries,
  receivedCount,
  type ImportSummary,
} from '@/features/sincronizacao/apply-package';
import {
  syncFailure,
  type SyncErrorCode,
  type SyncFailure,
} from '@/features/sincronizacao/error-codes';
import {
  generateTransferCode,
  openPackage,
  sealPackage,
  type RandomBytes,
} from '@/features/sincronizacao/package-crypto';
import {
  BATCH_MAX_BYTES,
  batchPackage,
  buildPackage,
  countRecords,
  estimateAttendanceSize,
  isCovered,
  PackageRefusedError,
  parsePackage,
  planBatches,
  splitPackage,
  type BatchEntry,
  type BatchTable,
  type PackageBatch,
  type RefusalReason,
} from '@/features/sincronizacao/sync-package';

export type ExportResult = {
  /** Digitado no outro tablet. Não é gravado. */
  code: string;
  fileName: string;
  contents: string;
  sent: number;
};

export type RefusalOrError = RefusalReason | 'erro';

export type ImportResult =
  | { ok: true; summary: ImportSummary }
  | { ok: false; reason: RefusalOrError; failure: SyncFailure };

export type LocalDescription = {
  deviceId: string;
  schemaVersion: number;
  vector: VersionVector;
};

/** Código de erro de cada recusa, por arquivo. */
export const FILE_ERROR_CODES: Record<RefusalOrError, SyncErrorCode> = {
  arquivo_invalido: 412,
  codigo_incorreto: 413,
  versao_incompativel: 414,
  mesmo_tablet: 415,
  tablet_revogado: 416,
  // Não acontece num arquivo, que vem inteiro de um tablet só.
  origem_trocada: 412,
  erro: 417,
};

/** Código de erro de cada recusa, pelo Nearby. */
export const NEARBY_ERROR_CODES: Record<RefusalOrError, SyncErrorCode> = {
  arquivo_invalido: 304,
  // O Nearby não usa código de transferência.
  codigo_incorreto: 304,
  versao_incompativel: 301,
  mesmo_tablet: 303,
  tablet_revogado: 311,
  origem_trocada: 312,
  erro: 313,
};

/** Parte dos lotes do arquivo entrou antes da falha. */
export const PARTIAL_IMPORT_CODE = 418;

/** Lotes que chegam numa troca pelo Nearby. Cada um é gravado numa transação. */
export type IncomingBatches = {
  apply(json: string, coverage: VersionVector): Promise<ImportResult>;
  /** Quantos lotes já foram gravados. */
  applied(): number;
  /** A soma dos lotes gravados. */
  summary(): ImportSummary;
  /**
   * Grava o histórico da troca. Depois de uma falha de gravação, ele já foi
   * gravado. `code`: o código de erro, se a troca parou antes do fim.
   */
  finish(complete: boolean, code?: SyncErrorCode): Promise<void>;
};

/** Lotes que este tablet manda numa troca pelo Nearby. */
export type OutgoingBatches = {
  total: number;
  /** Lê do banco só as avaliações do lote pedido. */
  read(index: number): Promise<{ pacote: string; cobertura: VersionVector }>;
  /**
   * Grava o histórico do envio: `sent` lotes confirmados pelo outro tablet.
   * `code`: o código de erro, se o envio parou antes do fim.
   */
  finish(sent: number, code?: SyncErrorCode): Promise<void>;
};

type LogResult = 'sucesso' | 'parcial' | 'recusado' | 'erro';

const pad = (value: number) => String(value).padStart(2, '0');

/** Só a data, sem dado pessoal. */
export function packageFileName(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `med-sincronizacao-${day}-${time}.medsync`;
}

type Stamped = { origem_id: string; origem_seq: number };

const toEntry = <T extends Stamped>(table: BatchTable, record: T): BatchEntry<unknown> => ({
  table,
  value: record,
  stamp: record,
  size: JSON.stringify(record).length,
});

type Dependencies = {
  repository?: SyncRepository;
  now?: () => Date;
  randomBytes?: RandomBytes;
  /** Tamanho alvo de cada lote. Os testes usam um menor, para ter vários lotes. */
  batchMaxBytes?: number;
};

/**
 * Arquivo: `exportPackage` e `importPackage`, com cifra pelo código. O arquivo leva
 * tudo, e quem importa grava lote por lote.
 * Nearby: `prepareBatchesFor` e `receiveBatches`, sem cifra própria, porque a
 * conexão já é cifrada.
 */
export function createSyncService({
  repository = createSyncRepository(),
  now = () => new Date(),
  randomBytes = getRandomBytesAsync,
  batchMaxBytes = BATCH_MAX_BYTES,
}: Dependencies = {}) {
  /**
   * Cada lote numa transação própria: se um falhar, os anteriores ficam, e o
   * vetor só avançou até onde eles cobrem. Um registro só no histórico por troca.
   */
  function createReceiver(codes: Record<RefusalOrError, SyncErrorCode>) {
    const startedAt = now();
    let peerId: string | null = null;
    let summary = emptySummary();
    let applied = 0;
    let closed = false;

    async function log(result: LogResult, code?: SyncErrorCode) {
      closed = true;
      const reason = code === undefined ? undefined : String(code);
      await (
        await repository.direct()
      ).writeLog({
        direction: 'recebimento',
        peerId,
        startedAt: startedAt.toISOString(),
        finishedAt: now().toISOString(),
        received: receivedCount(summary),
        conflicts: summary.conflicts,
        quarantined: summary.quarantined,
        result,
        reason,
      });
    }

    const refusal = (reason: RefusalOrError): ImportResult => ({
      ok: false,
      reason,
      failure: syncFailure(codes[reason], { kept: applied > 0 }),
    });

    async function apply(read: () => Promise<PackageBatch>): Promise<ImportResult> {
      if (closed) return refusal('erro');
      try {
        const { pacote: syncPackage, cobertura } = await read();
        // Todos os lotes de uma troca vêm do mesmo tablet.
        if (peerId !== null && syncPackage.origem !== peerId) {
          throw new PackageRefusedError('origem_trocada');
        }
        peerId = syncPackage.origem;
        const batch = await repository.inTransaction(async (operations) => {
          if (syncPackage.origem === (await operations.getLocalDeviceId())) {
            throw new PackageRefusedError('mesmo_tablet');
          }
          if (await operations.isDeviceRevoked(syncPackage.origem)) {
            throw new PackageRefusedError('tablet_revogado');
          }
          return applyPackage(operations, syncPackage, startedAt, cobertura);
        });
        summary = mergeSummaries(summary, batch);
        applied += 1;
        return { ok: true, summary: batch };
      } catch (error) {
        const reason = error instanceof PackageRefusedError ? error.reason : 'erro';
        let result: LogResult = reason === 'erro' ? 'erro' : 'recusado';
        if (applied > 0) result = 'parcial';
        await log(result, codes[reason]);
        return refusal(reason);
      }
    }

    return {
      apply,
      applied: () => applied,
      summary: () => summary,
      async finish(complete: boolean, code?: SyncErrorCode) {
        if (closed || applied === 0) return;
        await log(complete ? 'sucesso' : 'parcial', complete ? undefined : code);
      },
    };
  }

  return {
    async exportPackage(): Promise<ExportResult> {
      const startedAt = now();
      const syncPackage = await repository.inTransaction(async (operations) =>
        buildPackage({
          origin: await operations.getLocalDeviceId(),
          schemaVersion: SCHEMA_VERSION,
          generatedAt: startedAt.toISOString(),
          vector: await operations.readVector(),
          professionals: await operations.listProfessionals(),
          patients: await operations.listPatients(),
          attendances: await operations.listAttendances(),
          professionalAliases: await operations.listAliases('profissional'),
          patientAliases: await operations.listAliases('paciente'),
        }),
      );
      await (
        await repository.direct()
      ).writeLog({
        direction: 'envio',
        peerId: null,
        startedAt: startedAt.toISOString(),
        finishedAt: now().toISOString(),
        sent: countRecords(syncPackage),
        result: 'sucesso',
      });
      const code = await generateTransferCode(randomBytes);
      const contents = await sealPackage(JSON.stringify(syncPackage), code, randomBytes);
      return {
        code,
        fileName: packageFileName(startedAt),
        contents,
        sent: countRecords(syncPackage),
      };
    },

    /** Grava o arquivo lote por lote. Importar o mesmo arquivo de novo completa o que faltou. */
    async importPackage(contents: string, transferCode: string): Promise<ImportResult> {
      const receiver = createReceiver(FILE_ERROR_CODES);
      let rest: PackageBatch[] = [];
      let result = await receiver.apply(async () => {
        const [first, ...others] = splitPackage(
          parsePackage(await openPackage(contents, transferCode), SCHEMA_VERSION),
          batchMaxBytes,
        );
        rest = others;
        return first;
      });
      for (const batch of rest) {
        if (!result.ok) break;
        result = await receiver.apply(async () => batch);
      }
      if (!result.ok) {
        return receiver.applied() > 0
          ? { ...result, failure: syncFailure(PARTIAL_IMPORT_CODE) }
          : result;
      }
      await receiver.finish(true);
      return { ok: true, summary: receiver.summary() };
    },

    async describeLocal(): Promise<LocalDescription> {
      const operations = await repository.direct();
      return {
        deviceId: await operations.getLocalDeviceId(),
        schemaVersion: SCHEMA_VERSION,
        vector: await operations.readVector(),
      };
    },

    /**
     * Planeja os lotes com o que falta ao outro tablet. Os cadastros são lidos
     * agora; das avaliações, só os carimbos, e cada lote lê as suas na hora de ir.
     * O vetor é o do começo: o que mudar depois vai na troca seguinte.
     */
    async prepareBatchesFor(peerVector: VersionVector, peerId: string): Promise<OutgoingBatches> {
      const startedAt = now();
      const missing = <T extends Stamped>(records: T[]) =>
        records.filter((record) => !isCovered(peerVector, record.origem_id, record.origem_seq));
      const snapshot = await repository.inTransaction(async (operations) => ({
        header: buildPackage({
          origin: await operations.getLocalDeviceId(),
          schemaVersion: SCHEMA_VERSION,
          generatedAt: startedAt.toISOString(),
          vector: await operations.readVector(),
          professionals: [],
          patients: [],
          attendances: [],
          professionalAliases: await operations.listAliases('profissional'),
          patientAliases: await operations.listAliases('paciente'),
        }),
        professionals: missing(await operations.listProfessionals()),
        patients: missing(await operations.listPatients()),
        attendances: missing(await operations.listAttendanceStamps()),
      }));

      const batches = planBatches<unknown>(
        [
          ...snapshot.professionals.map((record) => toEntry('profissionais', record)),
          ...snapshot.patients.map((record) => toEntry('pacientes', record)),
          ...snapshot.attendances.map((stamp) => ({
            table: 'avaliacoes' as const,
            value: stamp.uuid,
            stamp,
            size: estimateAttendanceSize(stamp.bytes_imagens, stamp.eventos),
          })),
        ],
        snapshot.header.vetor,
        batchMaxBytes,
      );

      return {
        total: batches.length,

        async read(index) {
          const { entries, cobertura } = batches[index];
          const uuids = entries
            .filter((item) => item.table === 'avaliacoes')
            .map((item) => item.value as string);
          const attendances =
            uuids.length > 0 ? await (await repository.direct()).readAttendances(uuids) : [];
          const full = [
            ...entries.filter((item) => item.table !== 'avaliacoes'),
            ...attendances.map((record) => toEntry('avaliacoes', record)),
          ];
          return {
            pacote: JSON.stringify(batchPackage(snapshot.header, full, index === 0)),
            cobertura,
          };
        },

        async finish(sent, code) {
          let result: LogResult = sent > 0 ? 'parcial' : 'erro';
          if (sent >= batches.length) result = 'sucesso';
          await (
            await repository.direct()
          ).writeLog({
            direction: 'envio',
            peerId,
            startedAt: startedAt.toISOString(),
            finishedAt: now().toISOString(),
            sent: batches.slice(0, sent).reduce((total, batch) => total + batch.entries.length, 0),
            result,
            reason: result === 'sucesso' || code === undefined ? undefined : String(code),
          });
        },
      };
    },

    /** Recebe os lotes de uma troca pelo Nearby. */
    receiveBatches(): IncomingBatches {
      const receiver = createReceiver(NEARBY_ERROR_CODES);
      return {
        apply: (json, coverage) =>
          receiver.apply(async () => ({
            pacote: parsePackage(json, SCHEMA_VERSION),
            cobertura: coverage,
          })),
        applied: receiver.applied,
        summary: receiver.summary,
        finish: receiver.finish,
      };
    },

    async lastReceivedAt(): Promise<string | null> {
      return (await repository.direct()).lastReceivedAt();
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
