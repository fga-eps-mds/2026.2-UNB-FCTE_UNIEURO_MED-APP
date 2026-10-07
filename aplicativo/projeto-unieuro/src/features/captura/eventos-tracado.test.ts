import {
  acrescentarAcao,
  acrescentarTraco,
  calcularVelocidades,
  reconstruirTracos,
  resumirAmostragem,
  tracoParaCaminhoSvg,
  type EventoTracado,
  type Traco,
} from '@/features/captura/eventos-tracado';

const tracoA: Traco = [
  { x: 0, y: 0, instante: 0, pressao: 0.4, inclinacaoX: 10, inclinacaoY: -5 },
  { x: 3, y: 4, instante: 10, pressao: 0.5, inclinacaoX: 11, inclinacaoY: -4 },
];
const tracoB: Traco = [
  { x: 10, y: 10, instante: 100 },
  { x: 10, y: 20, instante: 120 },
  { x: 10, y: 30, instante: 125 },
];

function registrar(...tracos: Traco[]): EventoTracado[] {
  return tracos.reduce<EventoTracado[]>(
    (eventos, traco) => acrescentarTraco(eventos, traco, 'caneta'),
    [],
  );
}

describe('registro dos eventos do traçado', () => {
  it('marca o primeiro ponto de cada traço como início e numera os eventos em sequência', () => {
    const eventos = acrescentarAcao(registrar(tracoA, tracoB), 'desfazer', 200);

    expect(eventos.map((evento) => evento.tipo)).toEqual([
      'inicio',
      'ponto',
      'inicio',
      'ponto',
      'ponto',
      'desfazer',
    ]);
    expect(eventos.map((evento) => evento.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('não altera o registro recebido', () => {
    const eventos = registrar(tracoA);
    acrescentarTraco(eventos, tracoB, 'dedo');
    acrescentarAcao(eventos, 'limpar', 300);

    expect(eventos).toHaveLength(2);
  });
});

describe('reconstrução do desenho que vale', () => {
  it('devolve os traços na ordem em que foram feitos, com pressão e inclinação', () => {
    expect(reconstruirTracos(registrar(tracoA, tracoB))).toEqual([tracoA, tracoB]);
  });

  it('desfazer o último traço: remove só o último traço', () => {
    const eventos = acrescentarAcao(registrar(tracoA, tracoB), 'desfazer', 200);

    expect(reconstruirTracos(eventos)).toEqual([tracoA]);
  });

  it('refazer o desenho: limpar descarta todos os traços feitos até ali', () => {
    const limpo = acrescentarAcao(registrar(tracoA, tracoB), 'limpar', 200);
    const depois = acrescentarTraco(limpo, tracoA, 'caneta');

    expect(reconstruirTracos(limpo)).toEqual([]);
    expect(reconstruirTracos(depois)).toEqual([tracoA]);
  });

  it('desfazer sem traço na tela não tem efeito', () => {
    const eventos = acrescentarAcao(acrescentarAcao([], 'limpar', 0), 'desfazer', 1);

    expect(reconstruirTracos(eventos)).toEqual([]);
  });

  it('mantém no registro os traços desfeitos e as ações, como pede o modelo de dados', () => {
    const eventos = acrescentarAcao(registrar(tracoA, tracoB), 'desfazer', 200);

    expect(eventos.filter((evento) => evento.tipo === 'inicio')).toHaveLength(2);
    expect(eventos.at(-1)).toEqual({ tipo: 'desfazer', ordem: 6, instante: 200 });
  });
});

describe('velocidade do traço', () => {
  it('calcula a velocidade pela distância e pelo tempo desde o ponto anterior', () => {
    // 5 px em 10 ms e depois 10 px em 20 ms: 500 px/s nos dois trechos.
    const traco: Traco = [
      { x: 0, y: 0, instante: 0 },
      { x: 3, y: 4, instante: 10 },
      { x: 3, y: 14, instante: 30 },
    ];

    expect(calcularVelocidades(traco)).toEqual([0, 500, 500]);
  });

  it('repete a velocidade anterior quando dois pontos chegam no mesmo milissegundo', () => {
    const traco: Traco = [
      { x: 0, y: 0, instante: 0 },
      { x: 0, y: 10, instante: 10 },
      { x: 0, y: 12, instante: 10 },
    ];

    expect(calcularVelocidades(traco)).toEqual([0, 1000, 1000]);
  });

  it('devolve lista vazia para traço vazio', () => {
    expect(calcularVelocidades([])).toEqual([]);
  });
});

describe('resumo da amostragem', () => {
  it('conta pontos e traços e mede a frequência só dentro dos traços', () => {
    // Intervalos: 10 ms no traço A; 20 e 5 ms no traço B. A pausa entre os
    // traços não entra na conta: 3 intervalos em 35 ms.
    const resumo = resumirAmostragem(registrar(tracoA, tracoB));

    expect(resumo.pontos).toBe(5);
    expect(resumo.tracos).toBe(2);
    expect(resumo.frequenciaHz).toBeCloseTo(3 / 0.035);
    expect(resumo.maiorIntervaloMs).toBe(20);
  });

  it('inclui os traços desfeitos, porque mede o aparelho e não o desenho', () => {
    const eventos = acrescentarAcao(registrar(tracoA, tracoB), 'limpar', 300);

    expect(resumirAmostragem(eventos).tracos).toBe(2);
  });

  it('indica se o aparelho informou pressão e quais ponteiros foram usados', () => {
    const comCaneta = resumirAmostragem(registrar(tracoA));
    const comDedo = resumirAmostragem(acrescentarTraco([], tracoB, 'dedo'));

    expect(comCaneta).toMatchObject({ comPressao: true, ponteiros: ['caneta'] });
    expect(comDedo).toMatchObject({ comPressao: false, ponteiros: ['dedo'] });
  });

  it('não divide por zero sem intervalo para medir', () => {
    const resumo = resumirAmostragem(registrar([{ x: 1, y: 1, instante: 0 }]));

    expect(resumo).toMatchObject({ pontos: 1, frequenciaHz: 0, maiorIntervaloMs: 0 });
  });
});

describe('caminho para desenhar', () => {
  it('liga os pontos do traço em ordem', () => {
    expect(tracoParaCaminhoSvg(tracoB)).toBe('M10 10 L10 20 L10 30');
  });

  it('desenha um ponto isolado como segmento de comprimento zero', () => {
    expect(tracoParaCaminhoSvg([{ x: 5, y: 6, instante: 0 }])).toBe('M5 6 L5 6');
  });

  it('devolve caminho vazio para traço vazio', () => {
    expect(tracoParaCaminhoSvg([])).toBe('');
  });
});
