import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import type { PointerType, TaskType, TracingEventRecord } from '@/db/drawing-repository';

/** Exame que pode ir para o modelo, com o traçado gravado de cada tarefa (#12). */
export type ExamForAnalysisRecord = {
  id: number;
  state: string;
  patientName: string;
  recordNumber: string;
  events: Record<TaskType, TracingEventRecord[]>;
};

/** Resultado do modelo como fica no banco. Os mapas são as 64 células de 8 × 8 em float32. */
export type ModelResultRecord = {
  probability: number;
  contributions: Record<TaskType, number>;
  maps: Record<TaskType, Float32Array>;
  modelVersion: string;
  durationMs: number;
  calculatedAt: string;
};

/** Quadro e traçado gravados de uma tarefa, para pôr o mapa do modelo sobre o desenho (#14). */
export type TraceRecord = { largura: number; altura: number; eventos: TracingEventRecord[] };

type ExamRow = { id: number; estado: string; nome_paciente: string; numero_ficha: string };

type EventRow = {
  tarefa: TaskType;
  ordem: number;
  tipo: TracingEventRecord['tipo'];
  ponteiro: PointerType | null;
  coord_x: number | null;
  coord_y: number | null;
  instante: number;
  pressao: number | null;
  inclinacao_x: number | null;
  inclinacao_y: number | null;
};

type ResultRow = {
  probabilidade: number;
  contribuicao_relogio: number;
  contribuicao_cubo: number;
  contribuicao_trilhas: number;
  mapa_relogio: Uint8Array;
  mapa_cubo: Uint8Array;
  mapa_trilhas: Uint8Array;
  versao_modelo: string;
  duracao_ms: number;
  data_hora: string;
};

const WAITING_STATES = "('processando_resultado', 'erro_inferencia')";

// Mesma trava da tela de resultado: o médico que aplicou ou um superusuário ativo. O
// exame excluído não vai para o modelo.
const FIND_EXAM = `SELECT a.id, a.estado, p.nome AS nome_paciente, p.numero_ficha
  FROM avaliacao a
  JOIN paciente p ON p.id = a.id_paciente
  WHERE a.id = ? AND a.excluido_em IS NULL
    AND (a.id_profissional = ?
      OR EXISTS (SELECT 1 FROM profissional s
        WHERE s.id = ? AND s.perfil = 'superusuario' AND s.ativo = 1))`;

const LIST_EVENTS = `SELECT t.tipo AS tarefa, e.ordem, e.tipo, e.ponteiro, e.coord_x, e.coord_y,
    e.instante, e.pressao, e.inclinacao_x, e.inclinacao_y
  FROM evento_tracado e
  JOIN tarefa t ON t.id = e.id_tarefa
  JOIN desenho d ON d.id_tarefa = t.id
  WHERE t.id_avaliacao = ?
  ORDER BY t.ordem, e.ordem`;

const LIST_TASKS = `SELECT t.tipo, t.largura, t.altura
  FROM tarefa t
  JOIN desenho d ON d.id_tarefa = t.id
  WHERE t.id_avaliacao = ?`;

const INSERT_RESULT = `INSERT INTO resultado_modelo (id_avaliacao, probabilidade,
    contribuicao_relogio, contribuicao_cubo, contribuicao_trilhas,
    mapa_relogio, mapa_cubo, mapa_trilhas, versao_modelo, duracao_ms, data_hora)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const FIND_RESULT = `SELECT probabilidade, contribuicao_relogio, contribuicao_cubo,
    contribuicao_trilhas, mapa_relogio, mapa_cubo, mapa_trilhas, versao_modelo, duracao_ms,
    data_hora
  FROM resultado_modelo WHERE id_avaliacao = ?`;

function toEvent(row: EventRow): TracingEventRecord {
  if (row.tipo === 'desfazer' || row.tipo === 'limpar') {
    return { tipo: row.tipo, ordem: row.ordem, instante: row.instante };
  }
  return {
    tipo: row.tipo,
    ordem: row.ordem,
    instante: row.instante,
    x: row.coord_x ?? 0,
    y: row.coord_y ?? 0,
    ponteiro: row.ponteiro ?? 'desconhecido',
    ...(row.pressao === null ? {} : { pressao: row.pressao }),
    ...(row.inclinacao_x === null ? {} : { inclinacaoX: row.inclinacao_x }),
    ...(row.inclinacao_y === null ? {} : { inclinacaoY: row.inclinacao_y }),
  };
}

const listEvents = (database: SQLiteDatabase, examId: number) =>
  database.getAllAsync<EventRow>(LIST_EVENTS, [examId]);

// O float32 do mapa vai para o banco como os próprios bytes, sem conversão de texto.
const mapToBlob = (map: Float32Array) =>
  new Uint8Array(map.buffer.slice(map.byteOffset, map.byteOffset + map.byteLength));

function blobToMap(blob: Uint8Array): Float32Array {
  const copy = new Uint8Array(blob);
  return new Float32Array(copy.buffer, 0, copy.byteLength / Float32Array.BYTES_PER_ELEMENT);
}

export function createModelResultRepository(open: () => Promise<SQLiteDatabase> = getDatabase) {
  return {
    /** Devolve `null` se o exame não existe, foi excluído ou se quem pede não pode vê-lo. */
    async findExamForAnalysis(
      requesterId: number,
      examId: number,
    ): Promise<ExamForAnalysisRecord | null> {
      const database = await open();
      const exam = await database.getFirstAsync<ExamRow>(FIND_EXAM, [
        examId,
        requesterId,
        requesterId,
      ]);
      if (!exam) return null;

      const events: Record<TaskType, TracingEventRecord[]> = { relogio: [], cubo: [], trilhas: [] };
      for (const row of await listEvents(database, examId)) events[row.tarefa].push(toEvent(row));
      return {
        id: exam.id,
        state: exam.estado,
        patientName: exam.nome_paciente,
        recordNumber: exam.numero_ficha,
        events,
      };
    },

    /**
     * Grava o resultado e conclui o exame na mesma transação: o exame nunca fica
     * "concluida" sem resultado, nem com resultado e ainda esperando o modelo.
     * Devolve `false` se o exame já não esperava o modelo.
     */
    async saveResult(examId: number, result: ModelResultRecord): Promise<boolean> {
      const database = await open();
      let saved = false;
      await database.withTransactionAsync(async () => {
        const exam = await database.getFirstAsync<{ espera: number }>(
          `SELECT 1 AS espera FROM avaliacao
           WHERE id = ? AND excluido_em IS NULL AND estado IN ${WAITING_STATES}
             AND NOT EXISTS (SELECT 1 FROM resultado_modelo WHERE id_avaliacao = avaliacao.id)`,
          [examId],
        );
        if (!exam) return;
        // O resultado entra antes da troca de estado, porque o gatilho do banco só aceita
        // resultado de exame que ainda espera o modelo.
        await database.runAsync(INSERT_RESULT, [
          examId,
          result.probability,
          result.contributions.relogio,
          result.contributions.cubo,
          result.contributions.trilhas,
          mapToBlob(result.maps.relogio),
          mapToBlob(result.maps.cubo),
          mapToBlob(result.maps.trilhas),
          result.modelVersion,
          result.durationMs,
          result.calculatedAt,
        ]);
        await database.runAsync(
          `UPDATE avaliacao SET estado = 'concluida', last_update = ? WHERE id = ?`,
          [result.calculatedAt, examId],
        );
        saved = true;
      });
      return saved;
    },

    /** Marca o erro do cálculo para o exame que estava sendo processado. */
    async markError(examId: number, at: string): Promise<void> {
      const database = await open();
      await database.runAsync(
        `UPDATE avaliacao SET estado = 'erro_inferencia', last_update = ?
         WHERE id = ? AND excluido_em IS NULL AND estado = 'processando_resultado'`,
        [at, examId],
      );
    },

    /**
     * Quadro e traçado de cada tarefa com desenho gravado. Não confere quem pede: a tela do
     * resultado só chama depois de abrir o exame pelo repositório que confere.
     */
    async findTraces(examId: number): Promise<Partial<Record<TaskType, TraceRecord>>> {
      const database = await open();
      const tasks = await database.getAllAsync<{ tipo: TaskType; largura: number; altura: number }>(
        LIST_TASKS,
        [examId],
      );
      const traces: Partial<Record<TaskType, TraceRecord>> = {};
      for (const { tipo, largura, altura } of tasks)
        traces[tipo] = { largura, altura, eventos: [] };
      for (const row of await listEvents(database, examId))
        traces[row.tarefa]?.eventos.push(toEvent(row));
      return traces;
    },

    /** Resultado gravado do exame, ou `null` se o modelo ainda não calculou. */
    async findResult(examId: number): Promise<ModelResultRecord | null> {
      const database = await open();
      const row = await database.getFirstAsync<ResultRow>(FIND_RESULT, [examId]);
      if (!row) return null;
      return {
        probability: row.probabilidade,
        contributions: {
          relogio: row.contribuicao_relogio,
          cubo: row.contribuicao_cubo,
          trilhas: row.contribuicao_trilhas,
        },
        maps: {
          relogio: blobToMap(row.mapa_relogio),
          cubo: blobToMap(row.mapa_cubo),
          trilhas: blobToMap(row.mapa_trilhas),
        },
        modelVersion: row.versao_modelo,
        durationMs: row.duracao_ms,
        calculatedAt: row.data_hora,
      };
    },
  };
}

export type SqliteModelResultRepository = ReturnType<typeof createModelResultRepository>;

export const modelResultRepository = createModelResultRepository();
