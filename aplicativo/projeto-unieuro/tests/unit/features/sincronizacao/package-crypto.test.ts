import { randomBytes as nodeRandomBytes } from 'node:crypto';

import {
  generateTransferCode,
  normalizeTransferCode,
  openPackage,
  sealPackage,
} from '@/features/sincronizacao/package-crypto';

const randomBytes = async (size: number) => new Uint8Array(nodeRandomBytes(size));
const CODE = 'ABCD-EFGH-JK23';

describe('código de transferência', () => {
  it('gera 12 caracteres do alfabeto, em grupos de 4', async () => {
    const code = await generateTransferCode(randomBytes);

    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it('usa os 5 bits de baixo de cada byte', async () => {
    const bytes = Uint8Array.from([0, 31, 32, 63, 1, 2, 3, 4, 5, 6, 7, 8]);

    await expect(generateTransferCode(async () => bytes)).resolves.toBe('A9A9-BCDE-FGHJ');
  });

  it('aceita o código sem hífens, com espaços e em minúsculas', () => {
    expect(normalizeTransferCode(' abcd efgh-jk23 ')).toBe('ABCDEFGHJK23');
  });

  it.each([
    ['curto', 'ABCD-EFGH'],
    ['com letra ambígua', 'ABCD-EFGH-JKI3'],
    ['com zero', 'ABCD-EFGH-JK03'],
  ])('recusa um código %s', (_case, code) => {
    expect(normalizeTransferCode(code)).toBeNull();
  });
});

describe('cifra do pacote', () => {
  it('decifra com o mesmo código o que foi cifrado', async () => {
    const sealed = await sealPackage('{"dado":"ação"}', CODE, randomBytes);

    await expect(openPackage(sealed, 'abcdefghjk23')).resolves.toBe('{"dado":"ação"}');
  });

  it('não deixa o conteúdo legível no arquivo', async () => {
    const sealed = await sealPackage('{"cpf":"11144477735"}', CODE, randomBytes);

    expect(sealed).not.toContain('11144477735');
    expect(sealed).not.toContain('ABCD');
  });

  it('recusa um código inválido ao cifrar', async () => {
    await expect(sealPackage('{}', 'curto', randomBytes)).rejects.toThrow('inválido');
  });

  it('recusa o código errado', async () => {
    const sealed = await sealPackage('{}', CODE, randomBytes);

    await expect(openPackage(sealed, 'ABCD-EFGH-JK24')).rejects.toMatchObject({
      reason: 'codigo_incorreto',
    });
    await expect(openPackage(sealed, 'curto')).rejects.toMatchObject({
      reason: 'codigo_incorreto',
    });
  });

  it('recusa um pacote com um byte alterado', async () => {
    const envelope = JSON.parse(await sealPackage('{"a":1}', CODE, randomBytes));
    const last = envelope.dados.slice(-2) === '00' ? '01' : '00';
    envelope.dados = envelope.dados.slice(0, -2) + last;

    await expect(openPackage(JSON.stringify(envelope), CODE)).rejects.toMatchObject({
      reason: 'codigo_incorreto',
    });
  });

  it('recusa um cabeçalho alterado, mesmo com o código certo', async () => {
    const envelope = JSON.parse(await sealPackage('{"a":1}', CODE, randomBytes));
    envelope.iteracoes += 1;

    await expect(openPackage(JSON.stringify(envelope), CODE)).rejects.toMatchObject({
      reason: 'codigo_incorreto',
    });
  });

  it.each([
    ['texto que não é JSON', () => 'abc'],
    ['outro formato', (envelope: Record<string, unknown>) => ({ ...envelope, formato: 'x' })],
    [
      'menos iterações que o mínimo',
      (envelope: Record<string, unknown>) => ({ ...envelope, iteracoes: 10 }),
    ],
    [
      'sal do tamanho errado',
      (envelope: Record<string, unknown>) => ({ ...envelope, sal: 'abcd' }),
    ],
    [
      'dados fora de hexadecimal',
      (envelope: Record<string, unknown>) => ({ ...envelope, dados: 'zz' }),
    ],
  ])('recusa um arquivo com %s', async (_case, change) => {
    const envelope = JSON.parse(await sealPackage('{}', CODE, randomBytes));
    const changed = change(envelope);
    const contents = typeof changed === 'string' ? changed : JSON.stringify(changed);

    await expect(openPackage(contents, CODE)).rejects.toMatchObject({ reason: 'arquivo_invalido' });
  });
});
