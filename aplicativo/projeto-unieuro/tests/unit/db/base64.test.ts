import { base64ToBytes, bytesToBase64, isBase64 } from '@/db/base64';

describe('BLOB em base64 para o pacote da sincronização', () => {
  it('volta aos mesmos bytes, inclusive os que não são texto', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 200, 255]);

    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('dá o mesmo resultado do base64 padrão', () => {
    expect(bytesToBase64(new TextEncoder().encode('MED'))).toBe('TUVE');
  });

  it('aguenta uma imagem maior que um bloco de conversão', () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, index) => index % 256);

    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it.each([
    ['vazio', '', false],
    ['com espaço', 'TU VE', false],
    ['sem o preenchimento', 'TUV', false],
    ['que não é texto', 42, false],
    ['válido', 'TUVE', true],
    ['válido com preenchimento', 'TUU=', true],
  ])('reconhece um texto %s', (_case, value, expected) => {
    expect(isBase64(value)).toBe(expected);
  });
});
