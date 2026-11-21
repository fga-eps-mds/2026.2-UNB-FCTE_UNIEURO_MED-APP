import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import type { MarcacaoRepository, TipoMarcacao } from '@/features/avaliacao/marcacao';

// Só os exames que o profissional aplicou e que não foram excluídos pela versão 11.
const EXAME_DO_PROFISSIONAL = `FROM avaliacao
  WHERE id = ? AND id_profissional = ? AND excluido_em IS NULL`;

const REGISTRO = `INSERT INTO marcacao (id_avaliacao, acao, tipo, id_profissional, data_hora)
  VALUES (?, ?, ?, ?, ?)`;

/**
 * Marcação do exame como teste ou material de ensino (#58). Nada sai do banco: as
 * colunas `marcacao`, `marcado_em` e `marcado_por` guardam a marcação de agora, e a
 * tabela `marcacao` guarda cada vez que ela foi feita ou desfeita. Os gatilhos da
 * versão 12 repetem a regra de que só quem aplicou o exame marca ou desmarca.
 */
export function createMarkingRepository(
  open: () => Promise<SQLiteDatabase> = getDatabase,
): MarcacaoRepository {
  return {
    async buscarExame(atendimentoId, profissionalId) {
      const database = await open();
      const row = await database.getFirstAsync<{ marcacao: TipoMarcacao | null }>(
        `SELECT marcacao ${EXAME_DO_PROFISSIONAL}`,
        [atendimentoId, profissionalId],
      );
      return row ? { marcacao: row.marcacao } : null;
    },

    async marcarExame(atendimentoId, profissionalId, tipo, dataHora) {
      const database = await open();
      let feito = false;
      // A conferência e a gravação ficam na mesma transação, para dois pedidos
      // seguidos não marcarem o mesmo exame duas vezes.
      await database.withTransactionAsync(async () => {
        const exame = await database.getFirstAsync<{ id: number }>(
          `SELECT id ${EXAME_DO_PROFISSIONAL} AND marcacao IS NULL`,
          [atendimentoId, profissionalId],
        );
        if (!exame) return;
        await database.runAsync(
          `UPDATE avaliacao SET marcacao = ?, marcado_em = ?, marcado_por = ?, last_update = ?
           WHERE id = ?`,
          [tipo, dataHora, profissionalId, dataHora, atendimentoId],
        );
        await database.runAsync(REGISTRO, [
          atendimentoId,
          'marcar',
          tipo,
          profissionalId,
          dataHora,
        ]);
        feito = true;
      });
      return feito;
    },

    async desmarcarExame(atendimentoId, profissionalId, dataHora) {
      const database = await open();
      let feito = false;
      await database.withTransactionAsync(async () => {
        const exame = await database.getFirstAsync<{ id: number }>(
          `SELECT id ${EXAME_DO_PROFISSIONAL} AND marcacao IS NOT NULL`,
          [atendimentoId, profissionalId],
        );
        if (!exame) return;
        await database.runAsync(
          `UPDATE avaliacao SET marcacao = NULL, marcado_em = NULL, marcado_por = NULL,
             last_update = ?
           WHERE id = ?`,
          [dataHora, atendimentoId],
        );
        await database.runAsync(REGISTRO, [
          atendimentoId,
          'desmarcar',
          null,
          profissionalId,
          dataHora,
        ]);
        feito = true;
      });
      return feito;
    },
  };
}

export const markingRepository = createMarkingRepository();
