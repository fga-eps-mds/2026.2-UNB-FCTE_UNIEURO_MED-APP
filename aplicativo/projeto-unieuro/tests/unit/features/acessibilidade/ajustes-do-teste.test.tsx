import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import {
  AJUSTES_PADRAO,
  AjustesDoTesteProvider,
  useAjustesDoTeste,
  type AjustesDoTeste,
  type AjustesDoTesteStore,
} from '@/features/acessibilidade/ajustes-do-teste';

/** Mostra os ajustes e liga os dois, como fará a tela de configurações. */
function Painel() {
  const { ajustes, definirAjustes } = useAjustesDoTeste();
  return (
    <>
      <Text>{`contraste:${ajustes.altoContraste} letras:${ajustes.letrasMaiores}`}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => definirAjustes({ altoContraste: true, letrasMaiores: true })}>
        <Text>Ligar</Text>
      </Pressable>
    </>
  );
}

function criarStore(salvos: AjustesDoTeste | null = null) {
  let resolver: (valor: AjustesDoTeste | null) => void = () => undefined;
  const carregamento = new Promise<AjustesDoTeste | null>((resolve) => {
    resolver = resolve;
  });
  const store = {
    carregar: jest.fn(() => carregamento),
    salvar: jest.fn(async () => undefined),
  } satisfies AjustesDoTesteStore;
  return { store, terminarCarga: () => act(async () => resolver(salvos)) };
}

describe('ajustes do teste', () => {
  it('começa com os dois ajustes desligados', () => {
    expect(AJUSTES_PADRAO).toEqual({ altoContraste: false, letrasMaiores: false });

    render(
      <AjustesDoTesteProvider>
        <Painel />
      </AjustesDoTesteProvider>,
    );

    expect(screen.getByText('contraste:false letras:false')).toBeOnTheScreen();
  });

  it('fora do provider, as telas ficam com o padrão e mudar não tem efeito', async () => {
    render(<Painel />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Ligar' }));

    expect(screen.getByText('contraste:false letras:false')).toBeOnTheScreen();
  });

  it('a tela de configurações muda os ajustes para todas as telas', async () => {
    render(
      <AjustesDoTesteProvider>
        <Painel />
      </AjustesDoTesteProvider>,
    );

    await userEvent.setup().press(screen.getByRole('button', { name: 'Ligar' }));

    expect(screen.getByText('contraste:true letras:true')).toBeOnTheScreen();
  });

  it('carrega a escolha guardada no tablet e grava a nova', async () => {
    const { store, terminarCarga } = criarStore({ altoContraste: true, letrasMaiores: false });
    render(
      <AjustesDoTesteProvider store={store}>
        <Painel />
      </AjustesDoTesteProvider>,
    );

    await terminarCarga();
    expect(screen.getByText('contraste:true letras:false')).toBeOnTheScreen();

    await userEvent.setup().press(screen.getByRole('button', { name: 'Ligar' }));
    expect(store.salvar).toHaveBeenCalledWith({ altoContraste: true, letrasMaiores: true });
  });

  it('não desfaz a escolha feita antes de a leitura do tablet terminar', async () => {
    const { store, terminarCarga } = criarStore({ altoContraste: false, letrasMaiores: false });
    render(
      <AjustesDoTesteProvider store={store}>
        <Painel />
      </AjustesDoTesteProvider>,
    );

    await userEvent.setup().press(screen.getByRole('button', { name: 'Ligar' }));
    await terminarCarga();

    expect(screen.getByText('contraste:true letras:true')).toBeOnTheScreen();
  });

  it('segue com o padrão se a leitura falhar, e não quebra se a gravação falhar', async () => {
    const store: AjustesDoTesteStore = {
      carregar: jest.fn(async () => {
        throw new Error('sem acesso');
      }),
      salvar: jest.fn(async () => {
        throw new Error('sem espaço');
      }),
    };
    render(
      <AjustesDoTesteProvider store={store}>
        <Painel />
      </AjustesDoTesteProvider>,
    );
    await act(async () => undefined);
    expect(screen.getByText('contraste:false letras:false')).toBeOnTheScreen();

    await userEvent.setup().press(screen.getByRole('button', { name: 'Ligar' }));

    expect(screen.getByText('contraste:true letras:true')).toBeOnTheScreen();
  });

  it('ignora a leitura que termina depois de a tela sair', async () => {
    const { store, terminarCarga } = criarStore({ altoContraste: true, letrasMaiores: true });
    const { unmount } = render(
      <AjustesDoTesteProvider store={store}>
        <Painel />
      </AjustesDoTesteProvider>,
    );

    unmount();

    await expect(terminarCarga()).resolves.toBeUndefined();
  });
});
