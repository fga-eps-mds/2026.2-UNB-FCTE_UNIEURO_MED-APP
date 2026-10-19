import { createAttendanceRepository, type PatientRecord } from '@/db/attendance-repository';
import { nextHlc } from '@/db/hlc';
import { createSyncRepository } from '@/db/sync-repository';
import { createSyncService, type SyncService } from '@/features/sincronizacao/sync-service';

import { abrirTablet, hashDaSenhaDeTeste, protetorComChave, type TabletDeTeste } from './tablet';

/**
 * Tablet de `tablet.ts` com chave de CPF própria e o serviço de sincronização.
 *
 * Declare no arquivo de teste:
 *
 *     jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));
 *     jest.mock('expo-crypto', () => {
 *       const crypto = jest.requireActual('node:crypto');
 *       return {
 *         getRandomBytesAsync: async (size: number) => new Uint8Array(crypto.randomBytes(size)),
 *       };
 *     });
 */

export type TabletSincronizavel = TabletDeTeste & {
  sync: SyncService;
  atendimentos: ReturnType<typeof createAttendanceRepository>;
};

let proximaChave = 20;

export async function abrirTabletSincronizavel(): Promise<TabletSincronizavel> {
  const tablet = (await abrirTablet(protetorComChave(proximaChave++))) as TabletSincronizavel;
  const open = async () => tablet.database;
  tablet.sync = createSyncService({ repository: createSyncRepository(open, tablet.protector) });
  tablet.atendimentos = createAttendanceRepository(open, tablet.protector);
  return tablet;
}

type Perfil = { name: string; email: string; crmNumber: string; crmState: string };

/** Devolve o `id` local. */
export async function cadastrar(
  tablet: TabletSincronizavel,
  perfil: Perfil,
  cpf: string,
  opcoes: { createdAt?: string; uuid?: string; passwordHash?: string } = {},
): Promise<number> {
  await tablet.repository.insert({
    ...perfil,
    cpf,
    passwordHash: opcoes.passwordHash ?? (await hashDaSenhaDeTeste()),
    createdAt: opcoes.createdAt ?? new Date().toISOString(),
  });
  // Só para escolher qual cadastro fica com o menor uuid.
  if (opcoes.uuid) {
    await tablet.database.runAsync('UPDATE profissional SET uuid = ? WHERE email = ?', [
      opcoes.uuid,
      perfil.email,
    ]);
  }
  const salvo = await tablet.repository.findByEmail(perfil.email);
  return salvo!.id;
}

export async function atender(
  tablet: TabletSincronizavel,
  professionalId: number,
  paciente: PatientRecord,
  startedAt = '2026-10-09T14:32:00.000Z',
): Promise<number> {
  const existente = await tablet.atendimentos.findPatientByCpf(paciente.cpf);
  const { attendanceId } = await tablet.atendimentos.createAttendance({
    patient: existente ?? paciente,
    professionalId,
    startedAt,
  });
  return attendanceId;
}

/** Com `agora`, marca a alteração com essa hora, para simular relógios diferentes. */
export async function alterar(
  tablet: TabletSincronizavel,
  tabela: 'profissional' | 'paciente' | 'avaliacao',
  campos: Record<string, string | number | null>,
  onde: string,
  parametros: readonly (string | number)[] = [],
  agora?: number,
): Promise<void> {
  const sets = Object.keys(campos).map((campo) => `${campo} = ?`);
  const valores = Object.values(campos);
  if (agora === undefined) {
    await tablet.database.runAsync(`UPDATE ${tabela} SET ${sets.join(', ')} WHERE ${onde}`, [
      ...valores,
      ...parametros,
    ]);
    return;
  }

  await tablet.database.withExclusiveTransactionAsync(async (txn) => {
    const contador = await txn.getFirstAsync<{
      origem_id: string;
      ultimo_seq: number;
      ultimo_hlc: string;
    }>(
      `SELECT c.origem_id, c.ultimo_seq, c.ultimo_hlc FROM sync_contador c
       JOIN dispositivo d ON d.id = c.origem_id WHERE d.local = 1`,
    );
    const hlc = nextHlc(contador!.ultimo_hlc, agora, contador!.origem_id);
    const seq = contador!.ultimo_seq + 1;
    await txn.runAsync(
      'UPDATE sync_contador SET ultimo_seq = ?, ultimo_hlc = ? WHERE origem_id = ?',
      [seq, hlc, contador!.origem_id],
    );
    await txn.runAsync(
      `UPDATE ${tabela} SET ${[...sets, 'versao_hlc = ?', 'origem_id = ?', 'origem_seq = ?'].join(', ')}
       WHERE ${onde}`,
      [...valores, hlc, contador!.origem_id, seq, ...parametros],
    );
  });
}

export async function enviarPorArquivo(de: TabletSincronizavel, para: TabletSincronizavel) {
  const pacote = await de.sync.exportPackage();
  return para.sync.importPackage(pacote.contents, pacote.code);
}

/** Como a troca pelo Nearby: só a diferença, sem cifra. */
export async function enviarDireto(de: TabletSincronizavel, para: TabletSincronizavel) {
  const destino = await para.sync.describeLocal();
  const pacote = await de.sync.preparePackageFor(destino.vector, destino.deviceId);
  return para.sync.applyPackageJson(pacote);
}

/** O que precisa ficar igual nos tablets. Sem `id`, CPF protegido e ficha, que são locais. */
export async function estado(tablet: TabletSincronizavel) {
  const { database } = tablet;
  return {
    profissionais: await database.getAllAsync(
      `SELECT uuid, nome, email, crm_numero, uf_crm, senha_hash, criacao, last_update, ativo,
         versao_hlc, origem_id, origem_seq
       FROM profissional ORDER BY uuid`,
    ),
    pacientes: await database.getAllAsync(
      `SELECT uuid, nome, data_nascimento, escolaridade_anos, sexo, criacao, last_update,
         versao_hlc, origem_id, origem_seq
       FROM paciente ORDER BY uuid`,
    ),
    atendimentos: await database.getAllAsync(
      `SELECT a.uuid, p.uuid AS profissional_uuid, pa.uuid AS paciente_uuid, a.data_hora_inicio,
         a.estado, a.last_update, a.versao_hlc, a.origem_id, a.origem_seq
       FROM avaliacao a
       JOIN profissional p ON p.id = a.id_profissional
       JOIN paciente pa ON pa.id = a.id_paciente
       ORDER BY a.uuid`,
    ),
  };
}
