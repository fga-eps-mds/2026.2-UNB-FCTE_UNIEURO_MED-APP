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

// Texto do arquivo enviado pelo cliente: "TCLE — versão simples", de 15/09/2026.
// As escolhas dos itens 9 e 10 (SIM ou NÃO) e as linhas de assinatura do papel
// ficam fora do texto: a escolha e a assinatura são feitas na tela.
export const TERMO_TCLE: TermoTcle = {
  versao: '15/09/2026 (versão simples)',
  provisorio: false,
  titulo: 'Termo de consentimento livre e esclarecido',
  pesquisa:
    'Uso de inteligência artificial no rastreamento de declínio cognitivo leve: desenvolvimento de aplicativo móvel como ferramenta de rastreio de baixo custo',
  pesquisador: 'Pesquisador responsável: Carlos Bernardo Tauil (médico neurologista), CRM 12771/DF',
  instituicao:
    'Centro Universitário Euro-Americano (UNIEURO) · Clínica Integrada Ana Lucia Chaves Fecury · Brasília–DF',
  secoes: [
    {
      titulo: 'Endereço e contato',
      paragrafos: [
        'Endereço da instituição: Avenida das Nações, Trecho 0, Conjunto 05, Brasília–DF, CEP 70.200-001.',
        'Telefone/WhatsApp: +55 61 9297-6707 · E-mail: carlos.tauil@neurosinapse.med.br',
      ],
    },
    {
      titulo: 'Convite e decisão de participar',
      paragrafos: [
        'O(A) senhor(a) está sendo convidado(a) a participar desta pesquisa. Participar é voluntário: o(a) senhor(a) só participa se quiser.',
        'Leia com calma. Se preferir, este termo pode ser lido para o(a) senhor(a). Se tiver dúvidas, pode perguntar a qualquer momento.',
        'O(a) senhor(a) pode dizer “não” ou desistir depois, a qualquer hora, sem precisar explicar o motivo, sem prejuízo e sem perder atendimento em qualquer serviço de saúde.',
      ],
    },
    {
      titulo: '1) Por que esta pesquisa está sendo feita?',
      paragrafos: [
        'Esta pesquisa quer avaliar um jeito mais simples e barato de ajudar a identificar sinais iniciais de mudanças na memória e no pensamento, conhecidos como Comprometimento Cognitivo Leve (CCL), em pessoas com 60 anos ou mais.',
        'Vamos comparar uma avaliação neuropsicológica completa (feita por profissional, com testes conhecidos), com um sistema de inteligência artificial (IA) que analisa fotos de desenhos feitos no papel. A pesquisa acontecerá em Brasília–DF e deve incluir cerca de 370 participantes.',
      ],
    },
    {
      titulo: '2) O que eu vou fazer se aceitar participar?',
      paragrafos: [
        'Se o(a) senhor(a) aceitar, fará 1 visita (aprox. 90 a 110 minutos) ou 2 visitas menores, conforme sua preferência e conforto.',
        'Parte A — Testes de memória e atenção. Um(a) profissional aplicará tarefas como perguntas, conversas e testes no papel (por exemplo: lembrar palavras, atenção, linguagem, velocidade etc.). Não há agulhas, coleta de sangue, exames invasivos ou uso de remédios.',
        'Parte B — Desenhos simples. O(a) senhor(a) fará 3 desenhos no papel: desenhar um relógio marcando um horário, copiar um cubo e copiar duas figuras sobrepostas. Depois, a equipe tirará fotos desses desenhos com um aparelho padronizado. Essas fotos serão analisadas pelo sistema de IA.',
        'Duração e local. A avaliação ocorrerá em uma sala do ambulatório Ana Lucia Chaves Fecury, em data e horário previamente combinados.',
        'A avaliação neuropsicológica será realizada por profissional habilitado. O profissional que aplicar e interpretar os testes não terá acesso ao resultado do aplicativo antes de concluir a avaliação, para que esse resultado não influencie a avaliação neuropsicológica.',
      ],
    },
    {
      titulo: '3) Vou receber algum resultado?',
      paragrafos: [
        'Sim. O resultado da avaliação neuropsicológica será explicado ao(à) senhor(a) pela equipe.',
        'O resultado do aplicativo/IA será mostrado de forma simples e não diagnóstica, por exemplo: “Sem sinal de alerta” ou “Recomendamos procurar um profissional de saúde”.',
        'Importante: o resultado do aplicativo não é diagnóstico de demência. Ele serve como um alerta para orientar se vale procurar avaliação profissional.',
        'Se a avaliação indicar alterações relevantes, o(a) senhor(a) receberá uma explicação individualizada, em linguagem simples, e orientação sobre a necessidade de procurar ou continuar o acompanhamento com um profissional de saúde. Quando houver indicação, a equipe poderá realizar encaminhamento para a Clínica-Escola de Psicologia, localizada na Avenida Castanheira, Lote 3700, Águas Claras, Brasília-DF, conforme a disponibilidade e o fluxo de atendimento do serviço.',
        'O encaminhamento não será definido apenas pelo resultado do aplicativo. A avaliação neuropsicológica e a avaliação clínica serão consideradas para orientar a conduta.',
        'Ao final do estudo, a equipe poderá divulgar (em linguagem simples) os resultados gerais para quem quiser receber.',
      ],
    },
    {
      titulo: '4) Quais são os riscos ou desconfortos?',
      paragrafos: [
        'Os riscos desta pesquisa são considerados mínimos. Ainda assim, podem ocorrer alguns desconfortos.',
        'Desconforto emocional: falar sobre memória, responder a perguntas e realizar testes de atenção e pensamento pode causar preocupação, ansiedade, tristeza, nervosismo ou constrangimento. Se isso acontecer, o(a) senhor(a) poderá fazer uma pausa, descansar, beber água ou interromper sua participação, sem qualquer prejuízo ao seu atendimento ou relacionamento com a instituição.',
        'A equipe oferecerá acolhimento e orientação. Se houver sofrimento emocional ou necessidade de apoio psicológico, o(a) senhor(a) poderá ser encaminhado(a) para a Clínica-Escola de Psicologia, localizada na Avenida Castanheira, Lote 3700, Águas Claras, Brasília-DF, conforme a disponibilidade e o fluxo de atendimento do serviço.',
        'Interpretação incorreta do resultado do aplicativo: como o aplicativo é experimental, ele poderá apresentar resultado incorreto. Um resultado indicando “Recomenda-se procurar um profissional de saúde” não significa que o(a) senhor(a) tenha demência, Comprometimento Cognitivo Leve ou outra doença. Da mesma forma, um resultado indicando “Nenhum sinal de alerta identificado” não garante que o(a) senhor(a) não tenha alteração de memória ou pensamento.',
        'Por esse motivo, o resultado do aplicativo não será considerado um diagnóstico. Ele será explicado por profissional de saúde e analisado junto com a avaliação neuropsicológica e as demais informações clínicas. Nenhuma decisão de tratamento será tomada exclusivamente com base no aplicativo.',
      ],
    },
    {
      titulo: '5) Quais são os benefícios?',
      paragrafos: [
        'Benefícios diretos para o(a) senhor(a): realizar uma avaliação neuropsicológica sem custo e, se houver indicação de alteração, receber orientação e encaminhamento.',
        'Benefício para a sociedade: contribuir para o desenvolvimento e avaliação de uma ferramenta de rastreio mais acessível, de baixo custo e potencialmente útil para ampliar o acesso à triagem.',
      ],
    },
    {
      titulo: '6) Vai ter custo? Vou receber dinheiro?',
      paragrafos: [
        'O(a) senhor(a) não paga nada para participar.',
        'O(a) senhor(a) não receberá pagamento por participar.',
        'Ressarcimento/Despesas: não haverá ressarcimento (por exemplo, transporte e alimentação).',
      ],
    },
    {
      titulo: '7) Se acontecer algum dano, tenho direito?',
      paragrafos: [
        'Sim. Se ocorrer algum problema de saúde ou dano por causa da pesquisa, o(a) senhor(a) tem direito à assistência à saúde necessária e, quando cabível, a indenização, conforme a legislação.',
        'Este termo não tira nenhum direito do(a) senhor(a) e não isenta pesquisadores, patrocinadores e instituições de responsabilidade.',
      ],
    },
    {
      titulo: '8) Como meus dados e minhas fotos serão protegidos?',
      paragrafos: [
        'Seus dados (informações e resultados) e as fotos dos desenhos serão tratados com sigilo e confidencialidade.',
        'Como será feito: seus dados serão identificados por código; seu nome e dados pessoais ficarão separados e com acesso restrito; somente a equipe autorizada terá acesso aos dados identificáveis; em publicações e apresentações, os resultados serão apresentados de forma agrupada (sem identificar participantes).',
        'Tempo de guarda: os dados serão guardados por 5 anos após o fim da pesquisa e depois eliminados de forma segura.',
        'As fotografias dos desenhos serão identificadas por código, sem o nome do participante. Elas poderão ser utilizadas para treinamento, validação e teste do sistema experimental, conforme descrito neste termo. Os avaliadores das imagens receberão as fotografias codificadas e não terão acesso ao nome do participante.',
        'Direitos sobre seus dados: o(a) senhor(a) pode solicitar acesso, correção e outras providências cabíveis, e pode retirar o consentimento, conforme regras aplicáveis e limitações técnicas/éticas (por exemplo, dados já analisados e anonimizados podem não ser recuperáveis). A pesquisa observará a LGPD e regras éticas de confidencialidade.',
        'Contato do responsável pelos dados do estudo: Carlos Bernardo Tauil, telefone +55 61 9297-6707, e-mail carlos.tauil@neurosinapse.med.br.',
      ],
    },
    {
      titulo: '9) Autorização para uso de fotos dos meus desenhos',
      paragrafos: [
        'As fotos serão usadas somente para fins científicos desta pesquisa (e, se autorizado abaixo, também para pesquisas futuras aprovadas por CEP). As fotos são dos desenhos, não do seu rosto.',
        'Se não autorizar, não será possível participar desta pesquisa, porque a análise por IA depende das fotos.',
      ],
    },
    {
      titulo: '10) Meus dados podem ser usados em pesquisa futura?',
      paragrafos: [
        'O(a) senhor(a) escolhe se autoriza o uso futuro dos dados e das fotos dos desenhos, apenas para outras pesquisas científicas, com aprovação por Comitê de Ética, e com proteção de sigilo.',
        'Se o(a) senhor(a) não autorizar, isso não impede sua participação nesta pesquisa.',
      ],
    },
    {
      titulo: '11) Comitê de Ética em Pesquisa (CEP) — para reclamações, dúvidas ou denúncias',
      paragrafos: [
        'Esta pesquisa foi avaliada e aprovada por um Comitê de Ética em Pesquisa (CEP). O CEP é um órgão independente que protege os direitos e o bem-estar de quem participa de pesquisa.',
        'CEP do UNIEURO. Endereço (Asa Sul): Av. das Nações, Trecho 0, Conjunto 5, Bloco B, 2º andar, Brasília, DF. Telefone: (61) 3445-5836. E-mail: cep@unieuro.com.br. Horário: 08:00 às 17:00.',
        '(Inserção do número CAAE após apreciação pelo CEP Unieuro via Plataforma Brasil.)',
      ],
    },
    {
      titulo: '12) Via do participante',
      paragrafos: ['O(a) senhor(a) receberá uma via deste termo assinada.'],
    },
  ],
  declaracao:
    'Declaro que li este termo (ou ele foi lido para mim), entendi as informações, pude fazer perguntas e recebi respostas, e aceito participar de forma voluntária.',
};

/** Como a versão aparece na tela. */
export function descreverVersao(termo: TermoTcle): string {
  const versao = `Versão do termo: ${termo.versao}`;
  return termo.provisorio ? `${versao} (texto provisório)` : versao;
}
