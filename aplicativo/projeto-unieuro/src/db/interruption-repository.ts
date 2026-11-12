import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';

/*
 * Os tipos abaixo espelham os da desistência (`features/avaliacao/interrupcao.ts`):
 * o banco não importa tipos da camada de aplicação, e a `composition.ts` da
 * feature confere, pelo tipo, que este repositório atende ao contrato dela.
 */

export type InterruptionReason = 'cansaco' | 'nao_quis_continuar' | 'mal_estar' | 'outro';

export type InterruptionRecord = {
  atendimentoId: number;
  /** Tarefa em que o paciente parou, de 1 a 3. */
  tarefa: number;
  motivo: InterruptionReason | null;
  /** Data e hora em ISO 8601, pelo relógio do tablet. */
  interrompidoEm: string;
};

export type InterruptedExamRecord = {
  atendimentoId: number;
  nomePaciente: string;
  fichaPaciente: string;
  tarefa: number;
  motivo: InterruptionReason | null;
  interrompidoEm: string;
  /** Ordem das tarefas com desenho confirmado, em ordem crescente. */
  tarefasGravadas: number[];
};

type InterruptedExamRow = {
  id: number;
  nome: string;
  numero_ficha: string;
  tarefa_interrupcao: number;
  motivo_interrupcao: InterruptionReason | null;
  data_hora_interrupcao: string;
};

/**
 * Persistência da desistência e da retomada do exame (#25). As duas só valem
 * para a avaliação do próprio profissional e no estado certo: só se desiste de
 * um exame em andamento, e só se retoma um exame interrompido.
 */
export function createInterruptionRepository(open: () => Promise<SQLiteDatabase> = getDatabase) {
  return {
    async interromper(registro: InterruptionRecord): Promise<boolean> {
      const database = await open();
      const resultado = await database.runAsync(
        `UPDATE avaliacao
         SET estado = 'interrompida', tarefa_interrupcao = ?, motivo_interrupcao = ?,
             data_hora_interrupcao = ?, last_update = ?
         WHERE id = ? AND estado = 'em_andamento'`,
        [
          registro.tarefa,
          registro.motivo,
          registro.interrompidoEm,
          registro.interrompidoEm,
          registro.atendimentoId,
        ],
      );
      return resultado.changes === 1;
    },

    async buscarInterrompido(
      atendimentoId: number,
      profissionalId: number,
    ): Promise<InterruptedExamRecord | null> {
      const database = await open();
      const row = await database.getFirstAsync<InterruptedExamRow>(
        `SELECT a.id, p.nome, p.numero_ficha, a.tarefa_interrupcao, a.motivo_interrupcao,
                a.data_hora_interrupcao
         FROM avaliacao a
         JOIN paciente p ON p.id = a.id_paciente
         WHERE a.id = ? AND a.id_profissional = ? AND a.estado = 'interrompida'`,
        [atendimentoId, profissionalId],
      );
      if (!row) return null;

      const gravadas = await database.getAllAsync<{ ordem: number }>(
        `SELECT t.ordem FROM tarefa t
         JOIN desenho d ON d.id_tarefa = t.id
         WHERE t.id_avaliacao = ?
         ORDER BY t.ordem`,
        [atendimentoId],
      );

      return {
        atendimentoId: row.id,
        nomePaciente: row.nome,
        fichaPaciente: row.numero_ficha,
        tarefa: row.tarefa_interrupcao,
        motivo: row.motivo_interrupcao,
        interrompidoEm: row.data_hora_interrupcao,
        tarefasGravadas: gravadas.map((gravada) => gravada.ordem),
      };
    },

    async retomar(
      atendimentoId: number,
      profissionalId: number,
      retomadoEm: string,
    ): Promise<boolean> {
      const database = await open();
      const resultado = await database.runAsync(
        `UPDATE avaliacao SET estado = 'em_andamento', last_update = ?
         WHERE id = ? AND id_profissional = ? AND estado = 'interrompida'`,
        [retomadoEm, atendimentoId, profissionalId],
      );
      return resultado.changes === 1;
    },
  };
}

export type SqliteInterruptionRepository = ReturnType<typeof createInterruptionRepository>;

export const interruptionRepository = createInterruptionRepository();
