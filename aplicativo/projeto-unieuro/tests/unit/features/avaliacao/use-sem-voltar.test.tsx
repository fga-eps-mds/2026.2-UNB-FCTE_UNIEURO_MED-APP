import { renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { useSemVoltar } from '@/features/avaliacao/use-sem-voltar';

function espiarVoltar() {
  const remover = jest.fn();
  const inscrever = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation(() => ({ remove: remover }));
  return { inscrever, remover };
}

describe('useSemVoltar', () => {
  afterEach(() => jest.restoreAllMocks());

  it('consome o toque no botão voltar do Android, que então não faz nada', () => {
    const { inscrever } = espiarVoltar();

    renderHook(() => useSemVoltar());

    expect(inscrever).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    const [, aoVoltar] = inscrever.mock.calls[0];
    // Devolver `true` avisa o Android de que o toque já foi tratado.
    expect(aoVoltar({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);
  });

  it('devolve o botão voltar quando a tela sai', () => {
    const { remover } = espiarVoltar();
    const { unmount } = renderHook(() => useSemVoltar());
    expect(remover).not.toHaveBeenCalled();

    unmount();

    expect(remover).toHaveBeenCalledTimes(1);
  });
});
