import type { EventoTracado } from '@/features/captura/eventos-tracado';
import {
  LADO_DA_GRADE,
  montarMapaDoDesenho,
  type TracadoDoDesenho,
} from '@/features/resultado/mapa-do-desenho';

const QUADRO = { largura: 960, altura: 600 };

// Quadrado de 100 a 323 px: a caixa tem 223 px nos dois eixos, então cada pixel da entrada do
// modelo vale um pixel do quadro, deslocado em 84 (100 menos a borda de 16 px da entrada).
const QUADRADO: EventoTracado[] = [
  { tipo: 'inicio', ordem: 1, instante: 0, x: 100, y: 100, ponteiro: 'caneta' },
  { tipo: 'ponto', ordem: 2, instante: 16, x: 323, y: 100, ponteiro: 'caneta' },
  { tipo: 'ponto', ordem: 3, instante: 32, x: 323, y: 323, ponteiro: 'caneta' },
  { tipo: 'ponto', ordem: 4, instante: 48, x: 100, y: 323, ponteiro: 'caneta' },
];
const DESLOCAMENTO = 84;
const CELULA = 32;

const tracado = (eventos: EventoTracado[] = QUADRADO): TracadoDoDesenho => ({
  ...QUADRO,
  eventos,
});

function mapaCom(valores: Record<number, number>): Float32Array {
  const mapa = new Float32Array(LADO_DA_GRADE * LADO_DA_GRADE);
  for (const [indice, valor] of Object.entries(valores)) mapa[Number(indice)] = valor;
  return mapa;
}

describe('mapa sobre o desenho (#14)', () => {
  it('leva cada região do quadro do modelo para a imagem do desenho, com o lado que ela puxou', () => {
    const mapa = montarMapaDoDesenho(mapaCom({ 9: 2, 54: -1, 0: 0.1 }), tracado());

    expect(mapa?.proporcao).toBeCloseTo(960 / 600);
    expect(mapa?.regioes).toHaveLength(2);
    const [paraCcl, paraSemCcl] = mapa!.regioes;
    expect(paraCcl.esquerda).toBeCloseTo((CELULA + DESLOCAMENTO) / QUADRO.largura);
    expect(paraCcl.topo).toBeCloseTo((CELULA + DESLOCAMENTO) / QUADRO.altura);
    expect(paraCcl.largura).toBeCloseTo(CELULA / QUADRO.largura);
    expect(paraCcl.altura).toBeCloseTo(CELULA / QUADRO.altura);
    expect(paraCcl).toMatchObject({ intensidade: 1, puxaPara: 'ccl' });
    expect(paraSemCcl.esquerda).toBeCloseTo((6 * CELULA + DESLOCAMENTO) / QUADRO.largura);
    expect(paraSemCcl).toMatchObject({ intensidade: 0.5, puxaPara: 'sem-ccl' });
  });

  it('a região de efeito pequeno fica sem destaque', () => {
    const mapa = montarMapaDoDesenho(mapaCom({ 9: 4, 10: 0.9 }), tracado());

    expect(mapa?.regioes).toHaveLength(1);
  });

  it.each([
    [
      { 9: 2 },
      'O trecho que mais puxou o escore para CCL fica na parte de cima, à esquerda do desenho.',
    ],
    [{ 27: -3, 9: 1 }, 'O trecho que mais puxou o escore para sem CCL fica no centro do desenho.'],
    [
      { 62: 1 },
      'O trecho que mais puxou o escore para CCL fica na parte de baixo, à direita do desenho.',
    ],
    [
      { 4: 1 },
      'O trecho que mais puxou o escore para CCL fica na parte de cima, no centro do desenho.',
    ],
    [{ 31: 1 }, 'O trecho que mais puxou o escore para CCL fica no meio, à direita do desenho.'],
  ])('descreve onde fica a região de maior efeito (%j)', (valores, destaque) => {
    expect(montarMapaDoDesenho(mapaCom(valores), tracado())?.destaque).toBe(destaque);
  });

  it('a região que passa da borda da imagem fica cortada na borda', () => {
    const naBorda: EventoTracado[] = [
      { tipo: 'inicio', ordem: 1, instante: 0, x: 0, y: 0, ponteiro: 'caneta' },
      { tipo: 'ponto', ordem: 2, instante: 16, x: 223, y: 223, ponteiro: 'caneta' },
    ];

    const [regiao] = montarMapaDoDesenho(mapaCom({ 0: 1 }), tracado(naBorda))!.regioes;

    expect(regiao.esquerda).toBe(0);
    expect(regiao.topo).toBe(0);
    expect(regiao.largura).toBeGreaterThan(0);
  });

  it('o traço desfeito não conta para a posição da grade', () => {
    const comDesfeito: EventoTracado[] = [
      ...QUADRADO,
      { tipo: 'inicio', ordem: 5, instante: 60, x: 900, y: 580, ponteiro: 'caneta' },
      { tipo: 'desfazer', ordem: 6, instante: 70 },
    ];

    expect(montarMapaDoDesenho(mapaCom({ 9: 2 }), tracado(comDesfeito))).toEqual(
      montarMapaDoDesenho(mapaCom({ 9: 2 }), tracado()),
    );
  });

  it.each([
    ['sem traço', mapaCom({ 9: 1 }), [{ tipo: 'limpar', ordem: 5, instante: 60 }]],
    ['com o mapa todo zero', mapaCom({}), []],
    ['com o mapa fora da grade', new Float32Array(10).fill(1), []],
  ] as const)('não mostra mapa %s', (_caso, mapa, eventosExtras) => {
    expect(montarMapaDoDesenho(mapa, tracado([...QUADRADO, ...eventosExtras]))).toBeNull();
  });
});
