import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import type {
  ConsentimentoRepository,
  DecisaoConsentimento,
  EstadoAvaliacao,
} from '@/features/avaliacao/consentimento';

const ESTADO_DEPOIS_DA_DECISAO = {
  aceito: 'em_andamento',
  recusado: 'cancelada',
} as const;

/**
 * Persistência local do consentimento (#21). A mudança do estado e a criação
 * do registro acontecem juntas: uma falha em qualquer operação desfaz ambas.
 */
export function createConsentRepository(
  open: () => Promise<SQLiteDatabase> = getDatabase,
): ConsentimentoRepository {
  return {
    async salvarDecisao(decisao: DecisaoConsentimento): Promise<boolean> {
      const database = await open();
      let salva = false;

      await database.withTransactionAsync(async () => {
        const estado = decisao.aceito
          ? ESTADO_DEPOIS_DA_DECISAO.aceito
          : ESTADO_DEPOIS_DA_DECISAO.recusado;
        const atualizacao = await database.runAsync(
          `UPDATE avaliacao SET estado = ?, last_update = ?
           WHERE id = ? AND estado = 'aguardando_consentimento'`,
          [estado, decisao.decididoEm, decisao.atendimentoId],
        );

        if (atualizacao.changes !== 1) return;

        await database.runAsync(
          `INSERT INTO consentimento
             (id_avaliacao, versao_tcle, aceito, assinado_por, assinatura_png, data_hora,
              autoriza_imagens_pesquisa, autoriza_dados_pesquisa_futura)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            decisao.atendimentoId,
            decisao.versaoTermo,
            decisao.aceito ? 1 : 0,
            decisao.quemAssina,
            decisao.aceito ? decisao.assinaturaPng : null,
            decisao.decididoEm,
            decisao.autorizaImagensPesquisa == null
              ? null
              : Number(decisao.autorizaImagensPesquisa),
            decisao.autorizaDadosPesquisaFutura == null
              ? null
              : Number(decisao.autorizaDadosPesquisaFutura),
          ],
        );
        salva = true;
      });

      return salva;
    },

    async buscarEstado(atendimentoId: number): Promise<EstadoAvaliacao | null> {
      const database = await open();
      const row = await database.getFirstAsync<{ estado: EstadoAvaliacao }>(
        'SELECT estado FROM avaliacao WHERE id = ? LIMIT 1',
        [atendimentoId],
      );
      return row?.estado ?? null;
    },
  };
}

export const consentRepository = createConsentRepository();
