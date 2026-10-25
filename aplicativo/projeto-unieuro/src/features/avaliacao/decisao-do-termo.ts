import type { AssinaturaTermo } from '@/features/avaliacao/consent-decision';
import type { RegistrarDecisaoInput, ResultadoDecisao } from '@/features/avaliacao/consentimento';
import type { ContextoDecisao } from '@/features/avaliacao/termo-consentimento-screen';
import { gerarImagemDesenho } from '@/features/captura/imagem-desenho';

/** Para onde o fluxo segue depois da decisão do TCLE: as tarefas ou o início. */
export type DestinoDaDecisao = 'tarefas' | 'inicio';

export type RegistrarDecisao = (input: RegistrarDecisaoInput) => Promise<ResultadoDecisao>;

export const DECISAO_SEM_CONTEXTO = 'A decisão chegou sem a versão do termo e sem quem assina.';

function exigirContexto(contexto: ContextoDecisao | undefined): ContextoDecisao {
  // Os botões da tela do termo sempre entregam o contexto. Sem ele não há o que
  // gravar, e o erro libera a tela para outra tentativa.
  if (!contexto) throw new Error(DECISAO_SEM_CONTEXTO);
  return contexto;
}

function destino(resultado: ResultadoDecisao): DestinoDaDecisao {
  if (resultado.sucesso) return resultado.estado === 'em_andamento' ? 'tarefas' : 'inicio';
  // A decisão gravada antes vale. O portão das tarefas confere o estado dela e
  // abre a instrução ou volta ao início.
  return resultado.motivo === 'decisao_ja_registrada' ? 'tarefas' : 'inicio';
}

/**
 * Aceite do TCLE (#21): grava a imagem da assinatura em PNG com a versão do termo
 * e quem assinou. A imagem é gerada antes da gravação, para que uma assinatura
 * que não vira imagem não deixe um aceite gravado sem ela.
 */
export async function aceitarTermo(
  atendimentoId: number,
  assinatura: AssinaturaTermo,
  contexto: ContextoDecisao | undefined,
  registrar: RegistrarDecisao,
): Promise<DestinoDaDecisao> {
  const { quemAssina, versaoTermo } = exigirContexto(contexto);
  const assinaturaPng = gerarImagemDesenho(assinatura.tracos, assinatura.dimensoes);
  return destino(
    await registrar({ atendimentoId, versaoTermo, quemAssina, aceito: true, assinaturaPng }),
  );
}

/** Recusa do TCLE (#21): grava a decisão sem assinatura, e a avaliação é cancelada. */
export async function recusarTermo(
  atendimentoId: number,
  contexto: ContextoDecisao | undefined,
  registrar: RegistrarDecisao,
): Promise<DestinoDaDecisao> {
  const { quemAssina, versaoTermo } = exigirContexto(contexto);
  return destino(await registrar({ atendimentoId, versaoTermo, quemAssina, aceito: false }));
}
