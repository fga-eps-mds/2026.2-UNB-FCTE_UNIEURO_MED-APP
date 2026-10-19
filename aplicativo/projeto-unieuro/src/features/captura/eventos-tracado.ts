/**
 * Registro do traçado de uma tarefa de desenho.
 *
 * Segue a entidade EVENTO_TRACADO do modelo de dados (documento de arquitetura,
 * seções 8.1 e 8.4): cada ponto tocado pela caneta vira um evento, e desfazer e
 * limpar também são eventos. O registro guarda tudo, inclusive o que foi
 * desfeito, como decidido nas Atas 06 e 07; o desenho que vale é reconstruído a
 * partir dele.
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

function paraPonto({ x, y, instante, pressao, inclinacaoX, inclinacaoY }: EventoDePonto) {
  const ponto: PontoTracado = { x, y, instante };
  if (pressao !== undefined) ponto.pressao = pressao;
  if (inclinacaoX !== undefined) ponto.inclinacaoX = inclinacaoX;
  if (inclinacaoY !== undefined) ponto.inclinacaoY = inclinacaoY;
  return ponto;
}

/**
 * Acrescenta um ponto ao traço em andamento. Roda na thread de UI, a cada
 * evento do gesto. Um ponto na mesma posição e no mesmo milissegundo do
 * anterior é o mesmo evento entregue duas vezes e fica de fora; parado no mesmo
 * lugar em outro instante, ele entra, porque a caneta pode mudar a pressão.
 */
export function acrescentarPonto(traco: Traco, ponto: PontoTracado): Traco {
  'worklet';
  const ultimo = traco[traco.length - 1];
  const repetido =
    ultimo !== undefined &&
    ultimo.x === ponto.x &&
    ultimo.y === ponto.y &&
    ultimo.instante === ponto.instante;
  return repetido ? traco : [...traco, ponto];
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
 * pelo tempo desde o ponto anterior (documento de arquitetura, seção 4.2). O
 * primeiro ponto tem velocidade zero. Dois pontos no mesmo milissegundo repetem
 * a velocidade anterior, porque o tempo entre eles não pode ser medido.
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
 * Caminho no formato do SVG, que o Skia desenha. Um traço de um ponto só vira
 * um segmento de comprimento zero, que a ponta arredondada mostra como um ponto.
 */
export function tracoParaCaminhoSvg(traco: Traco): string {
  if (traco.length === 0) return '';
  const [primeiro, ...resto] = traco;
  const linhas = (resto.length > 0 ? resto : [primeiro]).map(({ x, y }) => `L${x} ${y}`);
  return [`M${primeiro.x} ${primeiro.y}`, ...linhas].join(' ');
}
