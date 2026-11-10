import type { SQLiteDatabase } from 'expo-sqlite';

import type { CpfProtector } from '@/db/cpf-protection';
import { cpfProtector } from '@/db/cpf-runtime';
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
 *
 * O CPF do responsável legal, quando existe, é gravado cifrado pelo mesmo
 * protetor do CPF do profissional e do paciente (AES-GCM com a chave do tablet).
 * O protetor é recebido como parâmetro para que os testes usem banco real e
 * chave fixa.
 */
export function createConsentRepository(
  open: () => Promise<SQLiteDatabase> = getDatabase,
  protector: CpfProtector = cpfProtector,
): ConsentimentoRepository {
  return {
    async salvarDecisao(decisao: DecisaoConsentimento): Promise<boolean> {
      const database = await open();
      let salva = false;

      // A cifra é calculada antes da transação, para que uma falha no Keystore
      // não deixe a transação aberta à espera dele.
      // Só o aceite pelo responsável legal identifica o responsável: em qualquer
      // outro caso o CPF recebido é descartado, em vez de depender do CHECK do banco.
      const cpfResponsavelCifrado =
        decisao.aceito && decisao.quemAssina === 'responsavel_legal' && decisao.cpfResponsavel
          ? await protector.encrypt(decisao.cpfResponsavel)
          : null;

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
              autoriza_imagens_pesquisa, autoriza_dados_pesquisa_futura,
              cpf_responsavel_cifrado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            cpfResponsavelCifrado,
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

    // Compara pelo índice de busca do CPF: o CPF do paciente não é decifrado.
    async cpfEhDoPaciente(atendimentoId: number, cpf: string): Promise<boolean> {
      const indice = await protector.blindIndex(cpf);
      const database = await open();
      const row = await database.getFirstAsync<{ igual: number }>(
        `SELECT 1 AS igual FROM avaliacao a
           JOIN paciente p ON p.id = a.id_paciente
          WHERE a.id = ? AND p.cpf_indice = ?
          LIMIT 1`,
        [atendimentoId, indice],
      );
      return row !== null;
    },
  };
}

export const consentRepository = createConsentRepository();
