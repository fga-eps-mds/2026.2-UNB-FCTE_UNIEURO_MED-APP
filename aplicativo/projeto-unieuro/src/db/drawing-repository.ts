import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import type { DesenhoConfirmado, DrawingRepository } from '@/features/captura/drawing';
import type { EventoDePonto, EventoTracado } from '@/features/captura/eventos-tracado';

const EVENT_COLUMNS = `id_tarefa, ordem, tipo, ponteiro, coord_x, coord_y, instante, pressao,
  inclinacao_x, inclinacao_y`;

// 100 eventos por INSERT ficam bem abaixo do limite de parâmetros do SQLite.
const EVENTS_PER_INSERT = 100;

const isPoint = (event: EventoTracado): event is EventoDePonto =>
  event.tipo === 'inicio' || event.tipo === 'ponto';

function eventParams(taskId: number, event: EventoTracado): SQLiteBindValue[] {
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
  events: readonly EventoTracado[],
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
export function createDrawingRepository(
  open: () => Promise<SQLiteDatabase> = getDatabase,
): DrawingRepository {
  return {
    async salvarDesenho(desenho: DesenhoConfirmado): Promise<void> {
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

export const drawingRepository = createDrawingRepository();
