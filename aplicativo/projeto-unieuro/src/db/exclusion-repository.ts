import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import { ESTADOS_FINALIZADOS, type ExclusaoRepository } from '@/features/avaliacao/exclusao';

const FINALIZADOS = `(${ESTADOS_FINALIZADOS.map((estado) => `'${estado}'`).join(', ')})`;

// Só os exames do profissional que ainda não foram excluídos.
const RESUMO_DO_PACIENTE = `SELECT COUNT(*) AS exames, SUM(estado IN ${FINALIZADOS}) AS finalizados
  FROM avaliacao
  WHERE id_paciente = ? AND id_profissional = ? AND excluido_em IS NULL`;

/**
 * Exclusão lógica de exame (#58) e de paciente (#47). Nada sai do banco: o exame
 * recebe `excluido_em` e `excluido_por`, e a tabela `exclusao` guarda o pedido.
 * Os gatilhos da versão 10 repetem a regra do exame finalizado.
 */
export function createExclusionRepository(
  open: () => Promise<SQLiteDatabase> = getDatabase,
): ExclusaoRepository {
  return {
    async buscarExame(atendimentoId, profissionalId) {
      const database = await open();
      const row = await database.getFirstAsync<{ estado: string }>(
        `SELECT estado FROM avaliacao
         WHERE id = ? AND id_profissional = ? AND excluido_em IS NULL`,
        [atendimentoId, profissionalId],
      );
      return row ? { estado: row.estado } : null;
    },

    async excluirExame(atendimentoId, profissionalId, dataHora) {
      const database = await open();
      let excluido = false;
      await database.withTransactionAsync(async () => {
        const exame = await database.getFirstAsync<{ id_paciente: number }>(
          `SELECT id_paciente FROM avaliacao
           WHERE id = ? AND id_profissional = ? AND excluido_em IS NULL
             AND estado NOT IN ${FINALIZADOS}`,
          [atendimentoId, profissionalId],
        );
        if (!exame) return;
        await database.runAsync(
          'UPDATE avaliacao SET excluido_em = ?, excluido_por = ?, last_update = ? WHERE id = ?',
          [dataHora, profissionalId, dataHora, atendimentoId],
        );
        await database.runAsync(
          `INSERT INTO exclusao (tipo, id_paciente, id_avaliacao, id_profissional, data_hora)
           VALUES ('exame', ?, ?, ?, ?)`,
          [exame.id_paciente, atendimentoId, profissionalId, dataHora],
        );
        excluido = true;
      });
      return excluido;
    },

    async resumirPaciente(pacienteId, profissionalId) {
      const database = await open();
      const row = await database.getFirstAsync<{ exames: number; finalizados: number | null }>(
        RESUMO_DO_PACIENTE,
        [pacienteId, profissionalId],
      );
      return { exames: row?.exames ?? 0, finalizados: row?.finalizados ?? 0 };
    },

    async excluirPaciente(pacienteId, profissionalId, dataHora) {
      const database = await open();
      let excluido = false;
      // A conferência e a marcação ficam na mesma transação, para um exame
      // finalizado no meio do caminho não ser excluído junto.
      await database.withTransactionAsync(async () => {
        const row = await database.getFirstAsync<{ exames: number; finalizados: number | null }>(
          RESUMO_DO_PACIENTE,
          [pacienteId, profissionalId],
        );
        if (!row || row.exames === 0 || (row.finalizados ?? 0) > 0) return;
        await database.runAsync(
          `UPDATE avaliacao SET excluido_em = ?, excluido_por = ?, last_update = ?
           WHERE id_paciente = ? AND id_profissional = ? AND excluido_em IS NULL`,
          [dataHora, profissionalId, dataHora, pacienteId, profissionalId],
        );
        await database.runAsync(
          `INSERT INTO exclusao (tipo, id_paciente, id_profissional, data_hora)
           VALUES ('paciente', ?, ?, ?)`,
          [pacienteId, profissionalId, dataHora],
        );
        excluido = true;
      });
      return excluido;
    },
  };
}

export const exclusionRepository = createExclusionRepository();
