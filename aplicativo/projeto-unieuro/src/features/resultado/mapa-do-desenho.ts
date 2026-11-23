import { reconstruirTracos, type EventoTracado } from '@/features/captura/eventos-tracado';
import { areaDaImagem } from '@/features/captura/imagem-desenho';
import {
  caixaDosTracos,
  fracaoDaCaixa,
  LADO_ENTRADA,
  voltarAoQuadro,
} from '@/features/inferencia/entrada-modelo';

/**
 * Onde o desenho pesou no escore (#14). O mapa do modelo vem da oclusão das regiões: cada célula diz
 * quanto a contribuição do desenho cai quando aquela região é coberta com papel em branco
 * (IA, docs/exportacao-do-modelo.md): positivo
 * puxou para CCL, negativo puxou para sem CCL. Aqui a grade volta do quadro de 256 px da entrada
 * do modelo para a imagem do desenho que o médico vê.
 */
export const LADO_DA_GRADE = 8;
const CELULA = LADO_ENTRADA / LADO_DA_GRADE;
// Abaixo de um quarto do maior efeito do desenho, a região fica sem destaque: perto de zero, o
// efeito de apagar é ruído e encheria a imagem de cor.
const DESTAQUE_MINIMO = 0.25;
// Os terços da caixa do desenho na entrada nomeiam a posição da região.
const UM_TERCO = 1 / 3;
const DOIS_TERCOS = 2 / 3;

export type PuxaPara = 'ccl' | 'sem-ccl';

/** Região em destaque, em frações da imagem gravada do desenho (0 a 1). */
export type RegiaoDoMapa = {
  esquerda: number;
  topo: number;
  largura: number;
  altura: number;
  /** Efeito da região dividido pelo maior efeito do desenho, de 0 a 1. */
  intensidade: number;
  puxaPara: PuxaPara;
};

export type MapaDoDesenho = {
  /** Largura dividida pela altura da imagem gravada, para alinhar a grade à imagem na tela. */
  proporcao: number;
  regioes: RegiaoDoMapa[];
  /** Frase com a posição da região de maior efeito, para o médico e para o leitor de tela. */
  destaque: string;
};

/** Traçado gravado de uma tarefa, com o tamanho do quadro em que foi feito. */
export type TracadoDoDesenho = {
  largura: number;
  altura: number;
  eventos: readonly EventoTracado[];
};

const limitar = (valor: number) => Math.min(1, Math.max(0, valor));

function posicao(linha: number, coluna: number): string {
  const vertical = fracaoDaCaixa(linha * CELULA + CELULA / 2);
  const horizontal = fracaoDaCaixa(coluna * CELULA + CELULA / 2);
  const alto =
    vertical < UM_TERCO ? 'na parte de cima' : vertical > DOIS_TERCOS ? 'na parte de baixo' : null;
  const lado = horizontal < UM_TERCO ? 'à esquerda' : horizontal > DOIS_TERCOS ? 'à direita' : null;
  if (alto && lado) return `${alto}, ${lado}`;
  if (alto) return `${alto}, no centro`;
  if (lado) return `no meio, ${lado}`;
  return 'no centro';
}

function frase(puxaPara: PuxaPara, linha: number, coluna: number): string {
  const lado = puxaPara === 'ccl' ? 'para CCL' : 'para sem CCL';
  return `O trecho que mais puxou o escore ${lado} fica ${posicao(linha, coluna)} do desenho.`;
}

/**
 * Regiões do mapa sobre a imagem gravada do desenho, ou `null` se não há o que mostrar: desenho
 * sem traço, mapa todo zero ou fora do tamanho da grade.
 */
export function montarMapaDoDesenho(
  mapa: Float32Array,
  { largura, altura, eventos }: TracadoDoDesenho,
): MapaDoDesenho | null {
  const tracos = reconstruirTracos(eventos).filter((traco) => traco.length > 0);
  if (tracos.length === 0 || mapa.length !== LADO_DA_GRADE * LADO_DA_GRADE) return null;
  const maior = mapa.reduce((atual, valor) => Math.max(atual, Math.abs(valor)), 0);
  if (!(maior > 0)) return null;

  // A mesma área e a mesma caixa da gravação e do preparo, para a grade cair sobre o traço.
  const area = areaDaImagem(tracos, { largura, altura });
  const { horizontal, vertical } = caixaDosTracos(tracos);
  const regioes: RegiaoDoMapa[] = [];
  let maisForte = 0;
  mapa.forEach((valor, indice) => {
    if (Math.abs(valor) > Math.abs(mapa[maisForte])) maisForte = indice;
    const intensidade = Math.abs(valor) / maior;
    if (intensidade < DESTAQUE_MINIMO) return;
    const linha = Math.floor(indice / LADO_DA_GRADE);
    const coluna = indice % LADO_DA_GRADE;
    const esquerda = limitar((voltarAoQuadro(coluna * CELULA, horizontal) - area.x) / area.largura);
    const direita = limitar(
      (voltarAoQuadro((coluna + 1) * CELULA, horizontal) - area.x) / area.largura,
    );
    const topo = limitar((voltarAoQuadro(linha * CELULA, vertical) - area.y) / area.altura);
    const base = limitar((voltarAoQuadro((linha + 1) * CELULA, vertical) - area.y) / area.altura);
    // Um traço reto não tem extensão num eixo, e a região some nele; o texto ainda a descreve.
    if (direita <= esquerda || base <= topo) return;
    regioes.push({
      esquerda,
      topo,
      largura: direita - esquerda,
      altura: base - topo,
      intensidade,
      puxaPara: valor > 0 ? 'ccl' : 'sem-ccl',
    });
  });

  const puxaPara: PuxaPara = mapa[maisForte] > 0 ? 'ccl' : 'sem-ccl';
  return {
    proporcao: area.largura / area.altura,
    regioes,
    destaque: frase(puxaPara, Math.floor(maisForte / LADO_DA_GRADE), maisForte % LADO_DA_GRADE),
  };
}
