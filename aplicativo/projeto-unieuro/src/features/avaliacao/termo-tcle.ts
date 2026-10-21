/**
 * Conteúdo do termo de consentimento livre e esclarecido (TCLE), apresentado ao
 * paciente ou ao responsável legal antes das tarefas de desenho (#21).
 *
 * O texto é do cliente. Cada texto novo é uma versão nova: a versão vai junto com
 * a decisão gravada, para saber a qual texto o paciente disse sim ou não.
 */
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

// Provisório: trechos do termo que aparecem no protótipo da #21. Troque pelo
// texto completo do arquivo do cliente e dê a ele um número de versão.
export const TERMO_TCLE: TermoTcle = {
  versao: 'rascunho',
  provisorio: true,
  titulo: 'Termo de consentimento livre e esclarecido',
  pesquisa:
    'Uso de inteligência artificial no rastreamento de declínio cognitivo leve: desenvolvimento de aplicativo móvel como ferramenta de rastreio de baixo custo',
  pesquisador: 'Pesquisador responsável: Carlos Bernardo Tauil, CRM 12771/DF',
  instituicao: 'UNIEURO · Clínica Integrada Ana Lucia Chaves Fecury · Brasília (DF)',
  secoes: [
    {
      titulo: 'Convite e decisão de participar',
      paragrafos: [
        'Participar é voluntário: o(a) senhor(a) só participa se quiser. Se preferir, este termo pode ser lido para o(a) senhor(a). Pode dizer não ou desistir depois, a qualquer hora, sem precisar explicar o motivo e sem perder atendimento.',
      ],
    },
    {
      titulo: '1) Por que esta pesquisa está sendo feita?',
      paragrafos: [
        'Para avaliar um jeito mais simples e barato de ajudar a identificar sinais iniciais de mudanças na memória e no pensamento em pessoas com 60 anos ou mais.',
      ],
    },
  ],
  declaracao:
    'Li este termo (ou ele foi lido para mim), entendi, pude fazer perguntas e aceito participar de forma voluntária.',
};

/** Como a versão aparece na tela. */
export function descreverVersao(termo: TermoTcle): string {
  const versao = `Versão do termo: ${termo.versao}`;
  return termo.provisorio ? `${versao} (texto provisório)` : versao;
}
