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
  versao: 1,
  dispositivo: DEVICE,
  versao_esquema: 2,
  vetor: { [DEVICE]: 3 },
};

const utf8Bytes = (text: string) => Buffer.byteLength(text, 'utf8');

describe('divisão em partes', () => {
  it('manda mensagem curta numa parte só e remonta igual', () => {
    const frames = frameMessage(hello, '1');

    expect(frames).toHaveLength(1);
    expect(createAssembler().push(frames[0])).toEqual(hello);
  });

  it('divide mensagem grande em partes que cabem no limite do Nearby', () => {
    const big: ProtocolMessage = { tipo: 'pacote', pacote: 'ção'.repeat(20_000) };

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
    const message: ProtocolMessage = { tipo: 'pacote', pacote: 'a😀😀😀b' };

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
    const message: ProtocolMessage = { tipo: 'pacote', pacote: '😀' };

    const frames = frameMessage(message, '1', 1);

    const assembler = createAssembler();
    expect(frames.map((frame) => assembler.push(frame)).at(-1)).toEqual(message);
  });

  it('remonta partes que chegam fora de ordem', () => {
    const message: ProtocolMessage = { tipo: 'pacote', pacote: 'x'.repeat(CHUNK_SIZE * 2) };
    const frames = frameMessage(message, '9');

    const assembler = createAssembler();
    const results = [...frames].reverse().map((frame) => assembler.push(frame));

    expect(results.at(-1)).toEqual(message);
  });

  it('não mistura partes de mensagens diferentes', () => {
    const first = frameMessage({ tipo: 'pacote', pacote: 'a'.repeat(CHUNK_SIZE + 1) }, '1');
    const second = frameMessage({ tipo: 'concluido' }, '2');

    const assembler = createAssembler();

    expect(assembler.push(first[0])).toBeNull();
    expect(assembler.push(second[0])).toEqual({ tipo: 'concluido' });
    expect(assembler.push(first[1])).toEqual({
      tipo: 'pacote',
      pacote: 'a'.repeat(CHUNK_SIZE + 1),
    });
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
    ['concluido', { tipo: 'concluido' }, { tipo: 'concluido' }],
    [
      'erro com motivo',
      { tipo: 'erro', motivo: 'versao_incompativel' },
      { tipo: 'erro', motivo: 'versao_incompativel' },
    ],
    ['erro sem motivo', { tipo: 'erro' }, { tipo: 'erro', motivo: 'erro' }],
    ['pacote', { tipo: 'pacote', pacote: '{}' }, { tipo: 'pacote', pacote: '{}' }],
  ])('lê %s', (_case, value, expected) => {
    expect(parseMessage(JSON.stringify(value))).toEqual(expected);
  });

  it.each([
    ['texto que não é JSON', 'abc'],
    ['lista', '[]'],
    ['tipo desconhecido', JSON.stringify({ tipo: 'outro' })],
    ['pacote sem conteúdo', JSON.stringify({ tipo: 'pacote' })],
    ['apresentação de outro formato', JSON.stringify({ ...hello, formato: 'x' })],
    ['apresentação sem uuid', JSON.stringify({ ...hello, dispositivo: 'tablet' })],
    ['apresentação com vetor inválido', JSON.stringify({ ...hello, vetor: { [DEVICE]: -1 } })],
  ])('recusa %s', (_case, text) => {
    expect(() => parseMessage(text)).toThrow(ProtocolError);
  });
});
