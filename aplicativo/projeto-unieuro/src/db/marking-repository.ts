import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import {
  lerMarcacao,
  type MarcacaoRepository,
  type TipoMarcacao,
} from '@/features/avaliacao/marcacao';

// Só os exames que o profissional aplicou e que não foram excluídos pela versão 11.
const EXAME_DO_PROFISSIONAL = `FROM avaliacao
  WHERE id = ? AND id_profissional = ? AND excluido_em IS NULL`;

const EXAMES_DO_PACIENTE_DO_PROFISSIONAL = `FROM avaliacao
  WHERE id_paciente = ? AND id_profissional = ? AND excluido_em IS NULL`;

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
        // O registro vem primeiro: o gatilho da versão 12 só aceita a marcação que
        // corresponde ao último registro do histórico.
        await database.runAsync(REGISTRO, [
          atendimentoId,
          'marcar',
          tipo,
          profissionalId,
          dataHora,
        ]);
        await database.runAsync(
          `UPDATE avaliacao SET marcacao = ?, marcado_em = ?, marcado_por = ?, last_update = ?
           WHERE id = ?`,
          [tipo, dataHora, profissionalId, dataHora, atendimentoId],
        );
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
        await database.runAsync(REGISTRO, [
          atendimentoId,
          'desmarcar',
          null,
          profissionalId,
          dataHora,
        ]);
        await database.runAsync(
          `UPDATE avaliacao SET marcacao = NULL, marcado_em = NULL, marcado_por = NULL,
             last_update = ?
           WHERE id = ?`,
          [dataHora, atendimentoId],
        );
        feito = true;
      });
      return feito;
    },

    async buscarPaciente(pacienteId, profissionalId) {
      const database = await open();
      const rows = await database.getAllAsync<{ marcacao: string | null }>(
        `SELECT marcacao ${EXAMES_DO_PACIENTE_DO_PROFISSIONAL}`,
        [pacienteId, profissionalId],
      );
      if (rows.length === 0) return null;
      return {
        totalExames: rows.length,
        marcacoes: rows.map((row) => lerMarcacao(row.marcacao)),
      };
    },

    async marcarPaciente(pacienteId, profissionalId, tipo, dataHora) {
      const database = await open();
      let feito = false;
      await database.withTransactionAsync(async () => {
        // Só os exames sem marcação: quem já foi marcado (por exame ou antes) fica como
        // está, como no `marcarExame`, e o histórico nunca tem dois "marcar" seguidos.
        const exames = await database.getAllAsync<{ id: number }>(
          `SELECT id ${EXAMES_DO_PACIENTE_DO_PROFISSIONAL} AND marcacao IS NULL`,
          [pacienteId, profissionalId],
        );
        if (exames.length === 0) return;
        for (const exame of exames) {
          await database.runAsync(REGISTRO, [exame.id, 'marcar', tipo, profissionalId, dataHora]);
        }
        await database.runAsync(
          `UPDATE avaliacao SET marcacao = ?, marcado_em = ?, marcado_por = ?, last_update = ?
           WHERE id_paciente = ? AND id_profissional = ? AND excluido_em IS NULL
             AND marcacao IS NULL`,
          [tipo, dataHora, profissionalId, dataHora, pacienteId, profissionalId],
        );
        feito = true;
      });
      return feito;
    },

    async desmarcarPaciente(pacienteId, profissionalId, dataHora) {
      const database = await open();
      let feito = false;
      await database.withTransactionAsync(async () => {
        const exames = await database.getAllAsync<{ id: number }>(
          `SELECT id ${EXAMES_DO_PACIENTE_DO_PROFISSIONAL} AND marcacao IS NOT NULL`,
          [pacienteId, profissionalId],
        );
        if (exames.length === 0) return;
        for (const exame of exames) {
          await database.runAsync(REGISTRO, [
            exame.id,
            'desmarcar',
            null,
            profissionalId,
            dataHora,
          ]);
        }
        await database.runAsync(
          `UPDATE avaliacao SET marcacao = NULL, marcado_em = NULL, marcado_por = NULL,
             last_update = ?
           WHERE id_paciente = ? AND id_profissional = ? AND excluido_em IS NULL
             AND marcacao IS NOT NULL`,
          [dataHora, pacienteId, profissionalId],
        );
        feito = true;
      });
      return feito;
    },
  };
}

export const markingRepository = createMarkingRepository();
