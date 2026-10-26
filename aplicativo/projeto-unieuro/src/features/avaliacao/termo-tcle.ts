/**
 * Conteúdo do termo de consentimento livre e esclarecido (TCLE), apresentado ao
 * paciente ou ao responsável legal antes das tarefas de desenho (#21).
 *
 * O texto é do cliente. Cada texto novo é uma versão nova: a versão vai junto com
 * a decisão gravada, para saber a qual texto o paciente disse sim ou não.
 */
import conteudoDoTermo from '@/features/avaliacao/termo-tcle.json';

export type SecaoTermo = {
  titulo: string;
  paragrafos: readonly string[];
};

export type TermoTcle = {
  versao: string;
  /** Texto ainda não conferido com a versão oficial enviada pelo cliente. */
  provisorio: boolean;
  titulo: string;
  pesquisa: string;
  pesquisador: string;
  instituicao: string;
  secoes: readonly SecaoTermo[];
  /** Frase que a pessoa confirma ao assinar. */
  declaracao: string;
};

export type QuemAssina = 'paciente' | 'responsavel_legal';

export const QUEM_ASSINA_OPCOES: readonly { valor: QuemAssina; rotulo: string }[] = [
  { valor: 'paciente', rotulo: 'Paciente' },
  { valor: 'responsavel_legal', rotulo: 'Responsável legal' },
];

// Texto do arquivo enviado pelo cliente: "TCLE — versão simples", de 15/09/2026.
// O conteúdo fica em `termo-tcle.json`, separado do código: uma versão nova do
// termo é só trocar o JSON e o campo `versao`. As escolhas dos itens 9 e 10 (SIM
// ou NÃO) e as linhas de assinatura do papel ficam fora do texto: a escolha e a
// assinatura são feitas na tela.
export const TERMO_TCLE: TermoTcle = conteudoDoTermo;

/** Como a versão aparece na tela. */
export function descreverVersao(termo: TermoTcle): string {
  const versao = `Versão do termo: ${termo.versao}`;
  return termo.provisorio ? `${versao} (texto provisório)` : versao;
}
