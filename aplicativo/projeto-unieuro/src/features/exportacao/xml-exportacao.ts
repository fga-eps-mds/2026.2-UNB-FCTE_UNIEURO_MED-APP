/**
 * XML da exportação (#22), versão 1 do esquema, descrita em `exportacao-v1.xsd`.
 *
 * O esquema ainda depende do aceite do parceiro. Esta versão segue a regra de
 * identificação pseudonimizada: o paciente aparece pelo número interno do tablet, sem nome, CPF,
 * ficha ou data de nascimento. Do paciente só vão a escolaridade, o sexo e a idade
 * no dia do exame, que são variáveis da análise.
 *
 * Exame sem TCLE aceito leva só a data, o estado e a decisão do termo: sem aceite
 * não há autorização para usar os dados da pessoa.
 */

export const VERSAO_ESQUEMA = '1';
export const NAMESPACE_EXPORTACAO = 'urn:mnema:exportacao:v1';

export type EventoExportado = {
  ordem: number;
  tipo: 'inicio' | 'ponto' | 'desfazer' | 'limpar';
  ponteiro: string | null;
  x: number | null;
  y: number | null;
  /** Milissegundos desde o início da tarefa. */
  instante: number;
  pressao: number | null;
  inclinacaoX: number | null;
  inclinacaoY: number | null;
};

export type TarefaExportada = {
  ordem: number;
  tipo: 'relogio' | 'cubo' | 'trilhas';
  largura: number;
  altura: number;
  inicio: string;
  termino: string | null;
  desenho: { confirmadoEm: string; png: Uint8Array } | null;
  eventos: readonly EventoExportado[];
};

export type TermoExportado = {
  versao: string;
  aceito: boolean;
  assinadoPor: 'paciente' | 'responsavel_legal';
  dataHora: string;
  autorizaImagens: boolean | null;
  autorizaPesquisaFutura: boolean | null;
};

export type ExameExportado = {
  /** Número interno do exame no tablet. */
  id: number;
  inicio: string;
  estado: string;
  termo: TermoExportado | null;
  tarefas: readonly TarefaExportada[];
};

export type PacienteExportado = {
  /** Número interno do paciente no tablet: não é a ficha nem o CPF. */
  id: number;
  /** AAAA-MM-DD. Só entra no cálculo da idade, nunca no arquivo. */
  dataNascimento: string;
  escolaridadeAnos: number;
  sexo: 'feminino' | 'masculino' | null;
  exames: readonly ExameExportado[];
};

export type CabecalhoExportacao = {
  geradaEm: string;
  versaoAplicativo: string;
  escopo: 'todos' | 'paciente';
  profissional: { crmNumero: string; crmUf: string };
};

const ENTIDADES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const escapar = (valor: string) => valor.replace(/[&<>"']/g, (c) => ENTIDADES[c]);

type Valor = string | number | boolean | null | undefined;

function atributos(campos: Record<string, Valor>): string {
  return Object.entries(campos)
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .map(([nome, valor]) => {
      const texto = typeof valor === 'boolean' ? (valor ? 'sim' : 'nao') : String(valor);
      return ` ${nome}="${escapar(texto)}"`;
    })
    .join('');
}

// Em blocos, para não estourar a pilha com imagens grandes no `fromCharCode`.
export function paraBase64(bytes: Uint8Array): string {
  const BLOCO = 0x2000;
  let binario = '';
  for (let inicio = 0; inicio < bytes.length; inicio += BLOCO) {
    binario += String.fromCharCode(...bytes.subarray(inicio, inicio + BLOCO));
  }
  return btoa(binario);
}

/** Idade em anos completos no dia do exame, pela data do tablet. */
export function idadeNoExame(dataNascimento: string, inicioDoExame: string): number {
  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const exame = new Date(inicioDoExame);
  const anos = exame.getFullYear() - ano;
  const mesExame = exame.getMonth() + 1;
  const fezAniversario = mesExame > mes || (mesExame === mes && exame.getDate() >= dia);
  return fezAniversario ? anos : anos - 1;
}

const consentiu = (exame: ExameExportado) => exame.termo?.aceito === true;

function xmlDoEvento(evento: EventoExportado): string {
  return `        <evento${atributos({
    ordem: evento.ordem,
    tipo: evento.tipo,
    ponteiro: evento.ponteiro,
    x: evento.x,
    y: evento.y,
    instante: evento.instante,
    pressao: evento.pressao,
    inclinacaoX: evento.inclinacaoX,
    inclinacaoY: evento.inclinacaoY,
  })}/>`;
}

function xmlDaTarefa(tarefa: TarefaExportada): string {
  const linhas = [
    `      <tarefa${atributos({
      ordem: tarefa.ordem,
      tipo: tarefa.tipo,
      largura: tarefa.largura,
      altura: tarefa.altura,
      inicio: tarefa.inicio,
      termino: tarefa.termino,
    })}>`,
    '        <tracado>',
    ...tarefa.eventos.map((evento) => `  ${xmlDoEvento(evento)}`),
    '        </tracado>',
  ];
  if (tarefa.desenho) {
    linhas.push(
      `        <desenho${atributos({
        confirmadoEm: tarefa.desenho.confirmadoEm,
        tipoMidia: 'image/png',
      })}>${paraBase64(tarefa.desenho.png)}</desenho>`,
    );
  }
  linhas.push('      </tarefa>');
  return linhas.join('\n');
}

function xmlDoExame(exame: ExameExportado, paciente: PacienteExportado): string {
  const aceito = consentiu(exame);
  const linhas = [
    `    <exame${atributos({
      id: exame.id,
      inicio: exame.inicio,
      estado: exame.estado,
      idadeAnos: aceito ? idadeNoExame(paciente.dataNascimento, exame.inicio) : null,
    })}>`,
  ];
  if (exame.termo) {
    linhas.push(
      `      <termo${atributos({
        versao: exame.termo.versao,
        aceito: exame.termo.aceito,
        assinadoPor: exame.termo.assinadoPor,
        dataHora: exame.termo.dataHora,
        autorizaImagens: exame.termo.autorizaImagens,
        autorizaPesquisaFutura: exame.termo.autorizaPesquisaFutura,
      })}/>`,
    );
  }
  if (aceito) {
    linhas.push(...exame.tarefas.map(xmlDaTarefa));
    // O modelo de IA ainda não está no aplicativo: nenhum exame tem resultado.
    linhas.push('      <resultado disponivel="nao"/>');
  }
  linhas.push('    </exame>');
  return linhas.join('\n');
}

function xmlDoPaciente(paciente: PacienteExportado): string {
  const algumAceite = paciente.exames.some(consentiu);
  return [
    `  <paciente${atributos({
      id: paciente.id,
      escolaridadeAnos: algumAceite ? paciente.escolaridadeAnos : null,
      sexo: algumAceite ? paciente.sexo : null,
    })}>`,
    ...paciente.exames.map((exame) => xmlDoExame(exame, paciente)),
    '  </paciente>',
  ].join('\n');
}

export function gerarXmlDeExportacao(
  pacientes: readonly PacienteExportado[],
  cabecalho: CabecalhoExportacao,
): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<exportacao${atributos({
      xmlns: NAMESPACE_EXPORTACAO,
      versaoEsquema: VERSAO_ESQUEMA,
      geradaEm: cabecalho.geradaEm,
      versaoAplicativo: cabecalho.versaoAplicativo,
      escopo: cabecalho.escopo,
    })}>`,
    `  <profissional${atributos({
      crm: cabecalho.profissional.crmNumero,
      uf: cabecalho.profissional.crmUf,
    })}/>`,
    ...pacientes.map(xmlDoPaciente),
    '</exportacao>',
    '',
  ].join('\n');
}
