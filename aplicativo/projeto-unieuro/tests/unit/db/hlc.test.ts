import { compareHlc, formatHlc, nextHlc, parseHlc, receiveHlc } from '@/db/hlc';

const A = 'aaaaaaaa-0000-4000-8000-000000000000';
const B = 'bbbbbbbb-0000-4000-8000-000000000000';

describe('formato', () => {
  it('escreve com largura fixa e lê de volta', () => {
    const value = formatHlc({ millis: 1_700_000_000_000, counter: 7, node: A });

    expect(value).toBe(`001700000000000-000007-${A}`);
    expect(parseHlc(value)).toEqual({ millis: 1_700_000_000_000, counter: 7, node: A });
  });

  it('não aceita texto fora do formato', () => {
    expect(parseHlc('')).toBeNull();
    expect(parseHlc('123-1-x')).toBeNull();
  });

  it('recusa um contador maior que o formato comporta', () => {
    expect(() => formatHlc({ millis: 1, counter: 1_000_000, node: A })).toThrow('esgotado');
  });

  it('ordena pela hora, depois pelo contador, depois pelo tablet', () => {
    const earlier = formatHlc({ millis: 999, counter: 50, node: B });
    const later = formatHlc({ millis: 1000, counter: 0, node: A });
    const laterSecond = formatHlc({ millis: 1000, counter: 1, node: A });
    const tieOtherTablet = formatHlc({ millis: 1000, counter: 1, node: B });

    expect(compareHlc(earlier, later)).toBeLessThan(0);
    expect(compareHlc(laterSecond, later)).toBeGreaterThan(0);
    expect(compareHlc(tieOtherTablet, laterSecond)).toBeGreaterThan(0);
    expect(compareHlc(later, later)).toBe(0);
  });
});

describe('nextHlc', () => {
  it('usa a hora atual quando ela passou do último valor', () => {
    expect(parseHlc(nextHlc(formatHlc({ millis: 10, counter: 3, node: A }), 20, A))).toEqual({
      millis: 20,
      counter: 0,
      node: A,
    });
  });

  it('começa do zero sem valor anterior', () => {
    expect(nextHlc('', 5, A)).toBe(formatHlc({ millis: 5, counter: 0, node: A }));
  });

  it('avança o contador quando o relógio volta para trás', () => {
    const last = formatHlc({ millis: 100, counter: 2, node: A });

    const next = nextHlc(last, 40, A);

    expect(parseHlc(next)).toEqual({ millis: 100, counter: 3, node: A });
    expect(compareHlc(next, last)).toBeGreaterThan(0);
  });
});

describe('receiveHlc', () => {
  it('fica depois do valor recebido mesmo com o relógio local atrasado', () => {
    const local = formatHlc({ millis: 10, counter: 0, node: A });
    const remote = formatHlc({ millis: 500, counter: 4, node: B });

    const advanced = receiveHlc(local, remote, 20, A);

    expect(parseHlc(advanced)).toEqual({ millis: 500, counter: 5, node: A });
    expect(compareHlc(nextHlc(advanced, 20, A), remote)).toBeGreaterThan(0);
  });

  it('avança o contador local quando o local está à frente', () => {
    const local = formatHlc({ millis: 900, counter: 1, node: A });
    const remote = formatHlc({ millis: 500, counter: 9, node: B });

    expect(parseHlc(receiveHlc(local, remote, 20, A))).toEqual({
      millis: 900,
      counter: 2,
      node: A,
    });
  });

  it('usa o maior contador quando os dois estão na mesma hora', () => {
    const local = formatHlc({ millis: 900, counter: 1, node: A });
    const remote = formatHlc({ millis: 900, counter: 6, node: B });

    expect(parseHlc(receiveHlc(local, remote, 20, A))).toEqual({
      millis: 900,
      counter: 7,
      node: A,
    });
  });

  it('usa a hora atual quando ela passou dos dois', () => {
    const local = formatHlc({ millis: 900, counter: 1, node: A });
    const remote = formatHlc({ millis: 950, counter: 6, node: B });

    expect(parseHlc(receiveHlc(local, remote, 2000, A))).toEqual({
      millis: 2000,
      counter: 0,
      node: A,
    });
  });

  it('parte do valor recebido quando não há valor local', () => {
    const remote = formatHlc({ millis: 950, counter: 6, node: B });

    expect(parseHlc(receiveHlc('', remote, 10, A))).toEqual({ millis: 950, counter: 7, node: A });
  });

  it('ignora um valor recebido fora do formato', () => {
    const local = formatHlc({ millis: 900, counter: 1, node: A });

    expect(receiveHlc(local, 'lixo', 2000, A)).toBe(local);
  });
});
