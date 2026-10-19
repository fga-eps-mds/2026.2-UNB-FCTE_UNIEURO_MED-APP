/**
 * Relógio lógico híbrido (HLC). Decide qual edição é a mais recente mesmo com o
 * relógio de um tablet errado.
 *
 * Formato `milissegundos-contador-tablet`, com largura fixa: a ordem alfabética
 * é a ordem das edições, e o id do tablet desempata.
 */

export type Hlc = { millis: number; counter: number; node: string };

const MILLIS_DIGITS = 15;
const COUNTER_DIGITS = 6;
const MAX_COUNTER = 10 ** COUNTER_DIGITS - 1;
const HLC_PATTERN = new RegExp(`^(\\d{${MILLIS_DIGITS}})-(\\d{${COUNTER_DIGITS}})-(.+)$`);

export function formatHlc({ millis, counter, node }: Hlc): string {
  if (counter > MAX_COUNTER) throw new Error('Contador do relógio lógico esgotado.');
  return [
    String(millis).padStart(MILLIS_DIGITS, '0'),
    String(counter).padStart(COUNTER_DIGITS, '0'),
    node,
  ].join('-');
}

export function parseHlc(value: string): Hlc | null {
  const parts = HLC_PATTERN.exec(value);
  if (!parts) return null;
  return { millis: Number(parts[1]), counter: Number(parts[2]), node: parts[3] };
}

/** Negativo se `a` é anterior a `b`, positivo se é posterior. */
export function compareHlc(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** HLC de uma gravação local. `last` é o último HLC conhecido. */
export function nextHlc(last: string, now: number, node: string): string {
  const previous = parseHlc(last);
  if (!previous || now > previous.millis) return formatHlc({ millis: now, counter: 0, node });
  return formatHlc({ millis: previous.millis, counter: previous.counter + 1, node });
}

/** Avança o relógio local para depois de um HLC recebido de outro tablet. */
export function receiveHlc(last: string, remote: string, now: number, node: string): string {
  const local = parseHlc(last);
  const received = parseHlc(remote);
  if (!received) return last;
  if (!local) return nextHlc(remote, now, node);

  const millis = Math.max(local.millis, received.millis, now);
  let counter = 0;
  if (millis === local.millis && millis === received.millis) {
    counter = Math.max(local.counter, received.counter) + 1;
  } else if (millis === local.millis) {
    counter = local.counter + 1;
  } else if (millis === received.millis) {
    counter = received.counter + 1;
  }
  return formatHlc({ millis, counter, node });
}
