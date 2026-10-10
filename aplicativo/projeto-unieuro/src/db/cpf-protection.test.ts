import { createCpfProtector } from '@/db/cpf-protection';

import { webCryptoAesGcm } from '../../test-support/web-crypto-aes-gcm';

const CPF = '11144477735';
const masterKey = new Uint8Array(32).fill(7);
const otherMasterKey = new Uint8Array(32).fill(9);

function createProtector(key = masterKey) {
  return createCpfProtector(async () => key, webCryptoAesGcm);
}

describe('encrypt e decrypt', () => {
  it('recupera o CPF original', async () => {
    const protector = createProtector();

    const stored = await protector.encrypt(CPF);

    await expect(protector.decrypt(stored)).resolves.toBe(CPF);
  });

  it('não deixa o CPF legível no que é gravado', async () => {
    const stored = await createProtector().encrypt(CPF);

    expect(stored).toMatch(/^aes-gcm\$1\$[0-9a-f]+$/);
    expect(stored).not.toContain(CPF);
  });

  it('gera um resultado diferente a cada cifra do mesmo CPF', async () => {
    const protector = createProtector();

    expect(await protector.encrypt(CPF)).not.toBe(await protector.encrypt(CPF));
  });

  it('não decifra com a chave de outro tablet', async () => {
    const stored = await createProtector().encrypt(CPF);

    await expect(createProtector(otherMasterKey).decrypt(stored)).rejects.toThrow();
  });

  it('recusa um valor adulterado', async () => {
    const protector = createProtector();
    const stored = await protector.encrypt(CPF);
    const lastDigit = stored.at(-1) === '0' ? '1' : '0';

    await expect(protector.decrypt(stored.slice(0, -1) + lastDigit)).rejects.toThrow();
  });

  it.each([['11144477735'], ['aes-gcm$2$abcd'], ['outra-cifra$1$abcd'], ['aes-gcm$1$']])(
    'recusa o formato desconhecido %s',
    async (stored) => {
      await expect(createProtector().decrypt(stored)).rejects.toThrow(
        'CPF gravado em formato desconhecido.',
      );
    },
  );
});

describe('blindIndex', () => {
  it('é sempre o mesmo para o mesmo CPF e tem 64 caracteres hexadecimais', async () => {
    const protector = createProtector();

    const first = await protector.blindIndex(CPF);

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(await protector.blindIndex(CPF)).toBe(first);
  });

  it('muda quando o CPF muda', async () => {
    const protector = createProtector();

    expect(await protector.blindIndex(CPF)).not.toBe(await protector.blindIndex('52998224725'));
  });

  it('depende da chave do tablet, então não dá para calculá-lo sem ela', async () => {
    expect(await createProtector().blindIndex(CPF)).not.toBe(
      await createProtector(otherMasterKey).blindIndex(CPF),
    );
  });

  it('não contém o CPF', async () => {
    expect(await createProtector().blindIndex(CPF)).not.toContain(CPF);
  });

  it('usa uma chave diferente da usada na cifra', async () => {
    const protector = createProtector();
    const index = await protector.blindIndex(CPF);
    const stored = await protector.encrypt(CPF);

    expect(stored).not.toContain(index);
  });
});

describe('chave-mestra', () => {
  it('é carregada uma única vez, mesmo com chamadas simultâneas', async () => {
    const loadMasterKey = jest.fn(async () => masterKey);
    const protector = createCpfProtector(loadMasterKey, webCryptoAesGcm);

    await Promise.all([protector.blindIndex(CPF), protector.encrypt(CPF), protector.encrypt(CPF)]);

    expect(loadMasterKey).toHaveBeenCalledTimes(1);
  });

  it('é carregada de novo depois de uma falha', async () => {
    const loadMasterKey = jest
      .fn<Promise<Uint8Array>, []>()
      .mockRejectedValueOnce(new Error('cofre indisponível'))
      .mockResolvedValueOnce(masterKey);
    const protector = createCpfProtector(loadMasterKey, webCryptoAesGcm);

    await expect(protector.blindIndex(CPF)).rejects.toThrow('cofre indisponível');
    await expect(protector.blindIndex(CPF)).resolves.toMatch(/^[0-9a-f]{64}$/);
    expect(loadMasterKey).toHaveBeenCalledTimes(2);
  });
});
