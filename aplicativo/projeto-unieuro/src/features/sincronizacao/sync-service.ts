import { getRandomBytesAsync } from 'expo-crypto';

import { SCHEMA_VERSION } from '@/db/schema';
import {
  createSyncRepository,
  type SyncRepository,
  type VersionVector,
} from '@/db/sync-repository';
import {
  applyPackage,
  receivedCount,
  type ImportSummary,
} from '@/features/sincronizacao/apply-package';
import {
  generateTransferCode,
  openPackage,
  sealPackage,
  type RandomBytes,
} from '@/features/sincronizacao/package-crypto';
import {
  buildPackage,
  countRecords,
  PackageRefusedError,
  parsePackage,
  type RefusalReason,
  type SyncPackage,
} from '@/features/sincronizacao/sync-package';

export type ExportResult = {
  /** Digitado no outro tablet. Não é gravado. */
  code: string;
  fileName: string;
  contents: string;
  sent: number;
};

export type ImportResult =
  | { ok: true; summary: ImportSummary }
  | { ok: false; reason: RefusalReason | 'erro'; message: string };

export type LocalDescription = {
  deviceId: string;
  schemaVersion: number;
  vector: VersionVector;
};

export const REFUSAL_MESSAGES: Record<RefusalReason | 'erro', string> = {
  arquivo_invalido: 'O arquivo escolhido não é um pacote de sincronização do MED.',
  codigo_incorreto:
    'O código não confere com este pacote. Confira o código exibido no outro tablet.',
  versao_incompativel:
    'Os dois tablets estão com versões diferentes do aplicativo. Atualize os dois e gere um novo pacote.',
  mesmo_tablet: 'Este pacote foi gerado neste mesmo tablet.',
  tablet_revogado: 'O tablet que gerou este pacote foi bloqueado e não pode mais enviar dados.',
  erro: 'Não foi possível importar o pacote. Nenhum dado foi alterado.',
};

const pad = (value: number) => String(value).padStart(2, '0');

/** Só a data, sem dado pessoal. */
export function packageFileName(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `med-sincronizacao-${day}-${time}.medsync`;
}

type Dependencies = {
  repository?: SyncRepository;
  now?: () => Date;
  randomBytes?: RandomBytes;
};

/**
 * Arquivo: `exportPackage` e `importPackage`, com cifra pelo código.
 * Nearby: `preparePackageFor` e `applyPackageJson`, sem cifra própria, porque a
 * conexão já é cifrada.
 */
export function createSyncService({
  repository = createSyncRepository(),
  now = () => new Date(),
  randomBytes = getRandomBytesAsync,
}: Dependencies = {}) {
  async function buildOutgoing(peerVector?: VersionVector, peerId: string | null = null) {
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
        peerVector,
      }),
    );
    await (
      await repository.direct()
    ).writeLog({
      direction: 'envio',
      peerId,
      startedAt: startedAt.toISOString(),
      finishedAt: now().toISOString(),
      sent: countRecords(syncPackage),
      result: 'sucesso',
    });
    return { syncPackage, startedAt };
  }

  // Recusa ou erro desfaz tudo e vai para o histórico, fora da transação.
  async function applyIncoming(read: () => Promise<SyncPackage>): Promise<ImportResult> {
    const startedAt = now();
    let peerId: string | null = null;
    try {
      const syncPackage = await read();
      peerId = syncPackage.origem;
      const summary = await repository.inTransaction(async (operations) => {
        if (syncPackage.origem === (await operations.getLocalDeviceId())) {
          throw new PackageRefusedError('mesmo_tablet');
        }
        if (await operations.isDeviceRevoked(syncPackage.origem)) {
          throw new PackageRefusedError('tablet_revogado');
        }
        const applied = await applyPackage(operations, syncPackage, startedAt);
        await operations.writeLog({
          direction: 'recebimento',
          peerId: syncPackage.origem,
          startedAt: startedAt.toISOString(),
          finishedAt: now().toISOString(),
          received: receivedCount(applied),
          conflicts: applied.conflicts,
          quarantined: applied.quarantined,
          result: 'sucesso',
        });
        return applied;
      });
      return { ok: true, summary };
    } catch (error) {
      const reason = error instanceof PackageRefusedError ? error.reason : 'erro';
      await (
        await repository.direct()
      ).writeLog({
        direction: 'recebimento',
        peerId,
        startedAt: startedAt.toISOString(),
        finishedAt: now().toISOString(),
        result: reason === 'erro' ? 'erro' : 'recusado',
        reason,
      });
      return { ok: false, reason, message: REFUSAL_MESSAGES[reason] };
    }
  }

  return {
    async exportPackage(): Promise<ExportResult> {
      const { syncPackage, startedAt } = await buildOutgoing();
      const code = await generateTransferCode(randomBytes);
      const contents = await sealPackage(JSON.stringify(syncPackage), code, randomBytes);
      return {
        code,
        fileName: packageFileName(startedAt),
        contents,
        sent: countRecords(syncPackage),
      };
    },

    importPackage(contents: string, transferCode: string): Promise<ImportResult> {
      return applyIncoming(async () =>
        parsePackage(await openPackage(contents, transferCode), SCHEMA_VERSION),
      );
    },

    async describeLocal(): Promise<LocalDescription> {
      const operations = await repository.direct();
      return {
        deviceId: await operations.getLocalDeviceId(),
        schemaVersion: SCHEMA_VERSION,
        vector: await operations.readVector(),
      };
    },

    async preparePackageFor(peerVector: VersionVector, peerId: string): Promise<string> {
      const { syncPackage } = await buildOutgoing(peerVector, peerId);
      return JSON.stringify(syncPackage);
    },

    applyPackageJson(json: string): Promise<ImportResult> {
      return applyIncoming(async () => parsePackage(json, SCHEMA_VERSION));
    },

    async lastReceivedAt(): Promise<string | null> {
      return (await repository.direct()).lastReceivedAt();
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
