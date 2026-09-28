import { hashPassword, verifyPassword } from '@/features/auth/password';

let mockSaltCalls = 0;

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async (size: number) => {
    mockSaltCalls += 1;
    return new Uint8Array(size).fill(mockSaltCalls);
  }),
}));

const PASSWORD = 'senhaForte123';

describe('hashPassword', () => {
  it('gera o hash no formato algoritmo$iteracoes$sal$chave', async () => {
    const hash = await hashPassword(PASSWORD);

    expect(hash).toMatch(/^pbkdf2-sha256\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  });

  it('gera hashes diferentes para a mesma senha quando o sal muda', async () => {
    const firstHash = await hashPassword(PASSWORD);
    const secondHash = await hashPassword(PASSWORD);

    expect(firstHash).not.toBe(secondHash);
  });
});

describe('verifyPassword', () => {
  let validHash: string;

  beforeAll(async () => {
    validHash = await hashPassword(PASSWORD);
  });

  it('aceita a senha usada para gerar o hash', async () => {
    await expect(verifyPassword(PASSWORD, validHash)).resolves.toBe(true);
  });

  it.each([
    ['senha diferente', () => ['outraSenha', validHash]],
    ['algoritmo desconhecido', () => [PASSWORD, validHash.replace('pbkdf2-sha256', 'md5')]],
    ['iterações não numéricas', () => [PASSWORD, validHash.replace('100000', 'abc')]],
    ['iterações zeradas', () => [PASSWORD, validHash.replace('100000', '0')]],
    ['sal ausente', () => [PASSWORD, 'pbkdf2-sha256$100000$$' + validHash.split('$')[3]]],
    ['chave ausente', () => [PASSWORD, validHash.split('$').slice(0, 3).join('$')]],
    ['chave com tamanho diferente', () => [PASSWORD, validHash.slice(0, -2)]],
  ])('rejeita quando há %s', async (_case, buildInput) => {
    const [password, hash] = buildInput();

    await expect(verifyPassword(password, hash)).resolves.toBe(false);
  });
});
