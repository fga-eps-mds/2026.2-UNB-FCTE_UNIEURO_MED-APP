import {
  CHUNK_SIZE,
  createAssembler,
  frameMessage,
  parseMessage,
  ProtocolError,
  type ProtocolMessage,
} from '@/features/sincronizacao/nearby-protocol';

const DEVICE = 'aaaaaaaa-0000-4000-8000-000000000000';

const hello: ProtocolMessage = {
  tipo: 'ola',
  formato: 'med-sync-p2p',
  versao: 2,
  dispositivo: DEVICE,
  versao_esquema: 2,
  vetor: { [DEVICE]: 3 },
};

const lote = (pacote: string): ProtocolMessage => ({
  tipo: 'lote',
  indice: 0,
  total: 1,
  cobertura: { [DEVICE]: 3 },
  pacote,
});

const utf8Bytes = (text: string) => Buffer.byteLength(text, 'utf8');

describe('divisão em partes', () => {
  it('manda mensagem curta numa parte só e remonta igual', () => {
    const frames = frameMessage(hello, '1');

    expect(frames).toHaveLength(1);
    expect(createAssembler().push(frames[0])).toEqual(hello);
  });

  it('divide mensagem grande em partes que cabem no limite do Nearby', () => {
    const big = lote('ção'.repeat(20_000));

    const frames = frameMessage(big, '7');

    expect(frames.length).toBeGreaterThan(1);
    for (const frame of frames) expect(utf8Bytes(frame)).toBeLessThan(32 * 1024);
    const assembler = createAssembler();
    const results = frames.map((frame) => assembler.push(frame));
    expect(results.slice(0, -1)).toEqual(frames.slice(1).map(() => null));
    expect(results.at(-1)).toEqual(big);
  });

  it('não separa um emoji entre duas partes', () => {
    // Com partes de 4 unidades, o emoji (2 unidades) cairia na divisa.
    const message = lote('a😀😀😀b');

    const frames = frameMessage(message, '1', 4);

    for (const frame of frames) {
      const body = frame.split('|').slice(3).join('|');
      expect(Buffer.from(body, 'utf8').toString('utf8')).toBe(body);
      expect(body).not.toMatch(/[\uD800-\uDBFF]$/);
    }
    const assembler = createAssembler();
    expect(frames.map((frame) => assembler.push(frame)).at(-1)).toEqual(message);
  });

  it('leva o par inteiro quando a parte tem uma unidade só', () => {
    const message = lote('😀');

    const frames = frameMessage(message, '1', 1);

    const assembler = createAssembler();
    expect(frames.map((frame) => assembler.push(frame)).at(-1)).toEqual(message);
  });

  it('remonta partes que chegam fora de ordem', () => {
    const message = lote('x'.repeat(CHUNK_SIZE * 2));
    const frames = frameMessage(message, '9');

    const assembler = createAssembler();
    const results = [...frames].reverse().map((frame) => assembler.push(frame));

    expect(results.at(-1)).toEqual(message);
  });

  it('não mistura partes de mensagens diferentes', () => {
    const first = frameMessage(lote('a'.repeat(CHUNK_SIZE + 1)), '1');
    const second = frameMessage({ tipo: 'lote_ok', indice: 0 }, '2');

    const assembler = createAssembler();

    expect(assembler.push(first[0])).toBeNull();
    expect(assembler.push(second[0])).toEqual({ tipo: 'lote_ok', indice: 0 });
    expect(assembler.push(first[1])).toEqual(lote('a'.repeat(CHUNK_SIZE + 1)));
  });

  it.each([
    ['sem cabeçalho', 'texto solto'],
    ['com índice além do total', '1|3|2|{}'],
    ['com total zero', '1|0|0|{}'],
  ])('recusa parte %s', (_case, frame) => {
    expect(() => createAssembler().push(frame)).toThrow(ProtocolError);
  });
});

describe('mensagens', () => {
  it.each([
    ['confirmação de lote', { tipo: 'lote_ok', indice: 3 }, { tipo: 'lote_ok', indice: 3 }],
    ['lote', lote('{}'), lote('{}')],
    [
      'erro com motivo',
      { tipo: 'erro', motivo: 'versao_incompativel' },
      { tipo: 'erro', motivo: 'versao_incompativel' },
    ],
    ['erro sem motivo', { tipo: 'erro' }, { tipo: 'erro', motivo: 'erro' }],
  ])('lê %s', (_case, value, expected) => {
    expect(parseMessage(JSON.stringify(value))).toEqual(expected);
  });

  it.each([
    ['texto que não é JSON', 'abc'],
    ['lista', '[]'],
    ['tipo desconhecido', JSON.stringify({ tipo: 'outro' })],
    ['o pacote único da versão 1', JSON.stringify({ tipo: 'pacote', pacote: '{}' })],
    ['lote sem conteúdo', JSON.stringify({ ...lote('{}'), pacote: undefined })],
    ['lote com índice além do total', JSON.stringify({ ...lote('{}'), indice: 1 })],
    ['lote com índice negativo', JSON.stringify({ ...lote('{}'), indice: -1 })],
    ['lote com total quebrado', JSON.stringify({ ...lote('{}'), total: 1.5 })],
    ['lote com cobertura inválida', JSON.stringify({ ...lote('{}'), cobertura: { x: 1 } })],
    ['confirmação sem índice', JSON.stringify({ tipo: 'lote_ok' })],
    ['apresentação da versão 1', JSON.stringify({ ...hello, versao: 1 })],
    ['apresentação de outro formato', JSON.stringify({ ...hello, formato: 'x' })],
    ['apresentação sem uuid', JSON.stringify({ ...hello, dispositivo: 'tablet' })],
    ['apresentação com vetor inválido', JSON.stringify({ ...hello, vetor: { [DEVICE]: -1 } })],
  ])('recusa %s', (_case, text) => {
    expect(() => parseMessage(text)).toThrow(ProtocolError);
  });
});
