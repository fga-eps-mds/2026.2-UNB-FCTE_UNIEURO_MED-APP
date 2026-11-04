import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';

/*
 * Os tipos abaixo espelham o `DesenhoConfirmado` e o `EventoTracado` da captura:
 * o banco não importa tipos da camada de aplicação, e a `composition.ts` da
 * feature confere, pelo tipo, que este repositório atende ao contrato dela.
 */

export type TaskType = 'relogio' | 'cubo' | 'trilhas';

export type PointerType = 'caneta' | 'dedo' | 'mouse' | 'desconhecido';

export type PointEventRecord = {
  tipo: 'inicio' | 'ponto';
  ordem: number;
  /** Milissegundos desde o início da tarefa. */
  instante: number;
  x: number;
  y: number;
  ponteiro: PointerType;
  pressao?: number;
  inclinacaoX?: number;
  inclinacaoY?: number;
};

export type ActionEventRecord = {
  tipo: 'desfazer' | 'limpar';
  ordem: number;
  instante: number;
};

export type TracingEventRecord = PointEventRecord | ActionEventRecord;

export type DrawingRecord = {
  atendimentoId: number;
  ordem: number;
  tipo: TaskType;
  largura: number;
  altura: number;
  /** Data e hora em ISO 8601, pelo relógio do tablet. */
  iniciadoEm: string;
  confirmadoEm: string;
  /** Inclui os traços desfeitos e apagados. */
  eventos: readonly TracingEventRecord[];
  imagemPng: Uint8Array;
};

const EVENT_COLUMNS = `id_tarefa, ordem, tipo, ponteiro, coord_x, coord_y, instante, pressao,
  inclinacao_x, inclinacao_y`;

// 100 eventos por INSERT ficam bem abaixo do limite de parâmetros do SQLite.
const EVENTS_PER_INSERT = 100;

const isPoint = (event: TracingEventRecord): event is PointEventRecord =>
  event.tipo === 'inicio' || event.tipo === 'ponto';

function eventParams(taskId: number, event: TracingEventRecord): SQLiteBindValue[] {
  if (!isPoint(event)) {
    return [taskId, event.ordem, event.tipo, null, null, null, event.instante, null, null, null];
  }
  return [
    taskId,
    event.ordem,
    event.tipo,
    event.ponteiro,
    event.x,
    event.y,
    event.instante,
    event.pressao ?? null,
    event.inclinacaoX ?? null,
    event.inclinacaoY ?? null,
  ];
}

async function insertEvents(
  database: SQLiteDatabase,
  taskId: number,
  events: readonly TracingEventRecord[],
) {
  for (let start = 0; start < events.length; start += EVENTS_PER_INSERT) {
    const batch = events.slice(start, start + EVENTS_PER_INSERT);
    const rows = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    await database.runAsync(
      `INSERT INTO evento_tracado (${EVENT_COLUMNS}) VALUES ${rows}`,
      batch.flatMap((event) => eventParams(taskId, event)),
    );
  }
}

/**
 * Persistência do desenho confirmado (#10). A tarefa, os eventos do traçado e o
 * desenho entram na mesma transação: se qualquer um falhar, nada fica gravado.
 */
export function createDrawingRepository(open: () => Promise<SQLiteDatabase> = getDatabase) {
  return {
    async salvarDesenho(desenho: DrawingRecord): Promise<void> {
      const database = await open();
      await database.withTransactionAsync(async () => {
        const tarefa = await database.runAsync(
          `INSERT INTO tarefa
             (id_avaliacao, tipo, ordem, largura, altura, data_hora_inicio, data_hora_termino)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            desenho.atendimentoId,
            desenho.tipo,
            desenho.ordem,
            desenho.largura,
            desenho.altura,
            desenho.iniciadoEm,
            desenho.confirmadoEm,
          ],
        );
        const taskId = tarefa.lastInsertRowId;
        await insertEvents(database, taskId, desenho.eventos);
        await database.runAsync(
          'INSERT INTO desenho (id_tarefa, imagem_final, data_hora_confirmacao) VALUES (?, ?, ?)',
          [taskId, desenho.imagemPng, desenho.confirmadoEm],
        );
      });
    },
  };
}

export type SqliteDrawingRepository = ReturnType<typeof createDrawingRepository>;

export const drawingRepository = createDrawingRepository();
