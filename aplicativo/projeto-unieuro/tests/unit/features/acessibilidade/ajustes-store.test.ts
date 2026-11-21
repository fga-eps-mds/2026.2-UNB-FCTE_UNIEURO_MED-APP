import { getItemAsync, setItemAsync } from 'expo-secure-store';

import {
  ajustesDoTesteStore,
  CHAVE_AJUSTES,
  createAjustesStore,
  type Armazenamento,
} from '@/features/acessibilidade/ajustes-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

function armazenamento(salvo: string | null): Armazenamento & { set: jest.Mock } {
  return { get: jest.fn(async () => salvo), set: jest.fn(async () => undefined) };
}

describe('ajustes guardados no tablet', () => {
  it('sem nada salvo, não devolve ajuste nenhum e as telas ficam com o padrão', async () => {
    await expect(createAjustesStore(armazenamento(null)).carregar()).resolves.toBeNull();
  });

  it('devolve os ajustes que o profissional escolheu', async () => {
    const store = createAjustesStore(
      armazenamento(JSON.stringify({ altoContraste: true, letrasMaiores: false })),
    );

    await expect(store.carregar()).resolves.toEqual({ altoContraste: true, letrasMaiores: false });
  });

  it.each([
    ['um texto que não é JSON', '{quebrado'],
    ['um JSON sem os dois ajustes', JSON.stringify({ altoContraste: true })],
    [
      'valores que não são verdadeiro ou falso',
      JSON.stringify({ altoContraste: 'sim', letrasMaiores: 1 }),
    ],
    ['um valor que não é objeto', JSON.stringify(42)],
    ['null', 'null'],
  ])('trata %s como nada salvo', async (_caso, salvo) => {
    await expect(createAjustesStore(armazenamento(salvo)).carregar()).resolves.toBeNull();
  });

  it('guarda só os dois ajustes, na chave do aplicativo', async () => {
    const local = armazenamento(null);

    await createAjustesStore(local).salvar({ altoContraste: false, letrasMaiores: true });

    expect(local.set).toHaveBeenCalledWith(
      CHAVE_AJUSTES,
      JSON.stringify({ altoContraste: false, letrasMaiores: true }),
    );
  });

  it('por padrão, usa o armazenamento do tablet (SecureStore)', async () => {
    jest
      .mocked(getItemAsync)
      .mockResolvedValueOnce(JSON.stringify({ altoContraste: true, letrasMaiores: true }));

    await expect(ajustesDoTesteStore.carregar()).resolves.toEqual({
      altoContraste: true,
      letrasMaiores: true,
    });
    await ajustesDoTesteStore.salvar({ altoContraste: true, letrasMaiores: true });

    expect(getItemAsync).toHaveBeenCalledWith(CHAVE_AJUSTES);
    expect(setItemAsync).toHaveBeenCalledWith(
      CHAVE_AJUSTES,
      JSON.stringify({ altoContraste: true, letrasMaiores: true }),
    );
  });
});
