/**
 * Registro do traçado de uma tarefa de desenho.
 *
 * Segue a entidade EVENTO_TRACADO do modelo de dados (documento de arquitetura,
 * seção 8.1): cada ponto tocado pela caneta vira um evento, e desfazer e limpar
 * também são eventos. O registro guarda tudo, inclusive o que foi desfeito; o
 * desenho que vale é reconstruído a partir dele, como pede a história #23.
 *
 * Um traço começa num evento `inicio` e segue com os eventos `ponto` até o
 * próximo `inicio`, `desfazer` ou `limpar`.
 */

export type TipoPonteiro = 'caneta' | 'dedo' | 'mouse' | 'desconhecido';

export type PontoTracado = {
  x: number;
  y: number;
  /** Milissegundos desde o início da tarefa. */
  instante: number;
  /** De 0 a 1. Ausente quando o aparelho não informa a pressão. */
  pressao?: number;
  /** Inclinação da caneta em graus, nos eixos x e y. Ausente sem caneta. */
  inclinacaoX?: number;
  inclinacaoY?: number;
};

export type EventoDePonto = PontoTracado & {
  tipo: 'inicio' | 'ponto';
  ordem: number;
  ponteiro: TipoPonteiro;
};

export type EventoDeAcao = {
  tipo: 'desfazer' | 'limpar';
  ordem: number;
  instante: number;
};

export type EventoTracado = EventoDePonto | EventoDeAcao;

export type Traco = PontoTracado[];

export type ResumoAmostragem = {
  pontos: number;
  tracos: number;
  /** Pontos por segundo dentro dos traços. Zero sem intervalo para medir. */
  frequenciaHz: number;
  /** Maior espera entre dois pontos seguidos do mesmo traço. */
  maiorIntervaloMs: number;
  comPressao: boolean;
  ponteiros: TipoPonteiro[];
};

function paraPonto({ x, y, instante, pressao, inclinacaoX, inclinacaoY }: EventoDePonto) {
  const ponto: PontoTracado = { x, y, instante };
  if (pressao !== undefined) ponto.pressao = pressao;
  if (inclinacaoX !== undefined) ponto.inclinacaoX = inclinacaoX;
  if (inclinacaoY !== undefined) ponto.inclinacaoY = inclinacaoY;
  return ponto;
}

/** Acrescenta um traço concluído ao registro, sem alterar o registro recebido. */
export function acrescentarTraco(
  eventos: readonly EventoTracado[],
  traco: Traco,
  ponteiro: TipoPonteiro,
): EventoTracado[] {
  const novos = traco.map(
    (ponto, indice): EventoDePonto => ({
      ...ponto,
      tipo: indice === 0 ? 'inicio' : 'ponto',
      ordem: eventos.length + indice + 1,
      ponteiro,
    }),
  );
  return [...eventos, ...novos];
}

/** Acrescenta um desfazer ou um limpar ao registro. */
export function acrescentarAcao(
  eventos: readonly EventoTracado[],
  tipo: EventoDeAcao['tipo'],
  instante: number,
): EventoTracado[] {
  return [...eventos, { tipo, ordem: eventos.length + 1, instante }];
}

/**
 * Devolve os traços que valem: desfazer remove só o último traço e limpar
 * descarta todos os traços feitos até ali.
 */
export function reconstruirTracos(eventos: readonly EventoTracado[]): Traco[] {
  const tracos: Traco[] = [];
  for (const evento of eventos) {
    if (evento.tipo === 'inicio') {
      tracos.push([paraPonto(evento)]);
    } else if (evento.tipo === 'ponto') {
      tracos.at(-1)?.push(paraPonto(evento));
    } else if (evento.tipo === 'desfazer') {
      tracos.pop();
    } else {
      tracos.length = 0;
    }
  }
  return tracos;
}

/**
 * Velocidade em cada ponto, em pixels por segundo, calculada pela distância e
 * pelo tempo desde o ponto anterior. O primeiro ponto tem velocidade zero. Dois
 * pontos no mesmo milissegundo repetem a velocidade anterior, porque o tempo
 * entre eles não pode ser medido.
 */
export function calcularVelocidades(traco: Traco): number[] {
  const velocidades: number[] = [];
  traco.forEach((ponto, indice) => {
    if (indice === 0) {
      velocidades.push(0);
      return;
    }
    const anterior = traco[indice - 1];
    const intervaloMs = ponto.instante - anterior.instante;
    if (intervaloMs <= 0) {
      velocidades.push(velocidades[indice - 1]);
      return;
    }
    const distancia = Math.hypot(ponto.x - anterior.x, ponto.y - anterior.y);
    velocidades.push((distancia / intervaloMs) * 1000);
  });
  return velocidades;
}

/**
 * Mede a amostragem de todos os traços do registro, inclusive os desfeitos: o
 * objetivo é saber com que frequência o aparelho entrega pontos.
 */
export function resumirAmostragem(eventos: readonly EventoTracado[]): ResumoAmostragem {
  const tracos: Traco[] = [];
  const ponteiros = new Set<TipoPonteiro>();
  let comPressao = false;

  for (const evento of eventos) {
    if (evento.tipo !== 'inicio' && evento.tipo !== 'ponto') continue;
    if (evento.tipo === 'inicio') {
      tracos.push([]);
      ponteiros.add(evento.ponteiro);
    }
    tracos.at(-1)?.push(evento);
    comPressao ||= evento.pressao !== undefined;
  }

  let intervalos = 0;
  let duracaoMs = 0;
  let maiorIntervaloMs = 0;
  for (const traco of tracos) {
    for (let indice = 1; indice < traco.length; indice += 1) {
      const intervalo = traco[indice].instante - traco[indice - 1].instante;
      intervalos += 1;
      duracaoMs += intervalo;
      maiorIntervaloMs = Math.max(maiorIntervaloMs, intervalo);
    }
  }

  return {
    pontos: tracos.reduce((total, traco) => total + traco.length, 0),
    tracos: tracos.length,
    frequenciaHz: duracaoMs > 0 ? (intervalos / duracaoMs) * 1000 : 0,
    maiorIntervaloMs,
    comPressao,
    ponteiros: [...ponteiros],
  };
}

/**
 * Caminho no formato do SVG, que o Skia desenha. Um traço de um ponto só vira
 * um segmento de comprimento zero, que a ponta arredondada mostra como um ponto.
 */
export function tracoParaCaminhoSvg(traco: Traco): string {
  if (traco.length === 0) return '';
  const [primeiro, ...resto] = traco;
  const linhas = (resto.length > 0 ? resto : [primeiro]).map(({ x, y }) => `L${x} ${y}`);
  return [`M${primeiro.x} ${primeiro.y}`, ...linhas].join(' ');
}
