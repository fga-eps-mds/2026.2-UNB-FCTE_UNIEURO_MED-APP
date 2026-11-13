import { createAttendanceRepository, type PatientRecord } from '@/db/attendance-repository';
import { createConsentRepository } from '@/db/consent-repository';
import { createDrawingRepository, type TaskType } from '@/db/drawing-repository';
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

/** Como a avaliação termina. `aberta` fica aguardando o consentimento. */
export type Desfecho = 'concluida' | 'interrompida' | 'cancelada' | 'em_andamento' | 'aberta';

export const ASSINATURA = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]);
export const CPF_DO_RESPONSAVEL = '39053344705';

const TAREFAS: readonly TaskType[] = ['relogio', 'cubo', 'trilhas'];

export type OpcoesDoAtendimento = {
  startedAt?: string;
  desfecho?: Desfecho;
  /** Aceite pelo responsável legal, com o CPF dele. */
  peloResponsavel?: boolean;
};

/**
 * Leva a avaliação ao desfecho pelos repositórios do aplicativo: TCLE, desenhos
 * com traçado e, por último, o estado final, como a captura vai fazer.
 */
export async function finalizar(
  tablet: TabletSincronizavel,
  attendanceId: number,
  { desfecho = 'concluida', peloResponsavel = false }: OpcoesDoAtendimento = {},
): Promise<void> {
  if (desfecho === 'aberta') return;
  const open = async () => tablet.database;
  const decididoEm = '2026-10-09T14:35:00.000Z';
  const consent = createConsentRepository(open, tablet.protector);
  const base = {
    atendimentoId: attendanceId,
    versaoTermo: 'tcle-2026-10',
    autorizaImagensPesquisa: true,
    autorizaDadosPesquisaFutura: false,
    decididoEm,
  };
  if (desfecho === 'cancelada') {
    await consent.salvarDecisao({ ...base, quemAssina: 'paciente', aceito: false });
    return;
  }
  await consent.salvarDecisao({
    ...base,
    aceito: true,
    assinaturaPng: ASSINATURA,
    ...(peloResponsavel
      ? { quemAssina: 'responsavel_legal', cpfResponsavel: CPF_DO_RESPONSAVEL }
      : { quemAssina: 'paciente' }),
  });
  if (desfecho === 'em_andamento') return;

  const drawings = createDrawingRepository(open);
  const quantas = desfecho === 'interrompida' ? 1 : TAREFAS.length;
  for (const [index, tipo] of TAREFAS.slice(0, quantas).entries()) {
    await drawings.salvarDesenho({
      atendimentoId: attendanceId,
      ordem: index + 1,
      tipo,
      largura: 800,
      altura: 600,
      iniciadoEm: '2026-10-09T14:40:00.000Z',
      confirmadoEm: '2026-10-09T14:42:00.000Z',
      eventos: [
        { tipo: 'inicio', ordem: 1, instante: 0, x: 10, y: 20, ponteiro: 'caneta', pressao: 0.6 },
        { tipo: 'ponto', ordem: 2, instante: 16, x: 11.5, y: 21, ponteiro: 'caneta' },
        { tipo: 'desfazer', ordem: 3, instante: 900 },
      ],
      imagemPng: new Uint8Array([137, 80, 78, 71, index]),
    });
  }
  await tablet.database.runAsync('UPDATE avaliacao SET estado = ? WHERE id = ?', [
    desfecho,
    attendanceId,
  ]);
}

/** Abre a avaliação e a finaliza (concluída, por padrão). Devolve o `id` local. */
export async function atender(
  tablet: TabletSincronizavel,
  professionalId: number,
  paciente: PatientRecord,
  opcoes: OpcoesDoAtendimento = {},
): Promise<number> {
  const existente = await tablet.atendimentos.findPatientByCpf(paciente.cpf);
  const { attendanceId } = await tablet.atendimentos.createAttendance({
    patient: existente ?? paciente,
    professionalId,
    startedAt: opcoes.startedAt ?? '2026-10-09T14:32:00.000Z',
  });
  await finalizar(tablet, attendanceId, opcoes);
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

/**
 * O que precisa ficar igual nos tablets. Sem `id`, CPF protegido e ficha, que são
 * locais. Só as avaliações finalizadas viajam, então só elas entram na comparação.
 */
export async function estado(tablet: TabletSincronizavel) {
  const { database } = tablet;
  const finalizada = "a.estado IN ('concluida', 'interrompida', 'cancelada')";
  return {
    profissionais: await database.getAllAsync(
      `SELECT uuid, nome, email, crm_numero, uf_crm, senha_hash, criacao, last_update, ativo, desativacao,
         versao_hlc, origem_id, origem_seq
       FROM profissional ORDER BY uuid`,
    ),
    pacientes: await database.getAllAsync(
      `SELECT uuid, nome, data_nascimento, escolaridade_anos, sexo, criacao, last_update, ativo,
         exclusao, versao_hlc, origem_id, origem_seq
       FROM paciente ORDER BY uuid`,
    ),
    atendimentos: await database.getAllAsync(
      `SELECT a.uuid, p.uuid AS profissional_uuid, pa.uuid AS paciente_uuid, a.data_hora_inicio,
         a.estado, a.ativo, a.exclusao, a.last_update, a.versao_hlc, a.origem_id, a.origem_seq
       FROM avaliacao a
       JOIN profissional p ON p.id = a.id_profissional
       JOIN paciente pa ON pa.id = a.id_paciente
       WHERE ${finalizada}
       ORDER BY a.uuid`,
    ),
    consentimentos: await database.getAllAsync(
      `SELECT a.uuid, c.versao_tcle, c.aceito, c.assinado_por, c.assinatura_png, c.data_hora,
         c.autoriza_imagens_pesquisa, c.autoriza_dados_pesquisa_futura,
         c.cpf_responsavel_cifrado IS NOT NULL AS tem_cpf_responsavel
       FROM consentimento c JOIN avaliacao a ON a.id = c.id_avaliacao
       WHERE ${finalizada}
       ORDER BY a.uuid`,
    ),
    tarefas: await database.getAllAsync(
      `SELECT a.uuid, t.tipo, t.ordem, t.largura, t.altura, t.data_hora_inicio, t.data_hora_termino,
         d.imagem_final, d.data_hora_confirmacao
       FROM tarefa t JOIN avaliacao a ON a.id = t.id_avaliacao
       LEFT JOIN desenho d ON d.id_tarefa = t.id
       WHERE ${finalizada}
       ORDER BY a.uuid, t.ordem`,
    ),
    eventos: await database.getAllAsync(
      `SELECT a.uuid, t.ordem AS tarefa, e.ordem, e.tipo, e.ponteiro, e.coord_x, e.coord_y, e.instante,
         e.pressao, e.inclinacao_x, e.inclinacao_y
       FROM evento_tracado e JOIN tarefa t ON t.id = e.id_tarefa
       JOIN avaliacao a ON a.id = t.id_avaliacao
       WHERE ${finalizada}
       ORDER BY a.uuid, t.ordem, e.ordem`,
    ),
  };
}
