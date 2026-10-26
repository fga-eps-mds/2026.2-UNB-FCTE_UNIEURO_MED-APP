import { renderHook, waitFor } from '@testing-library/react-native';

import { getTaskAccess } from '@/features/avaliacao/composition';
import { useConsentGate } from '@/features/avaliacao/use-consent-gate';

jest.mock('@/features/avaliacao/composition', () => ({
  getTaskAccess: jest.fn(),
}));

const mockGetTaskAccess = jest.mocked(getTaskAccess);

describe('useConsentGate', () => {
  it('mantém a tela fechada enquanto consulta o estado persistido', () => {
    mockGetTaskAccess.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useConsentGate('12'));

    expect(result.current).toBe('carregando');
    expect(mockGetTaskAccess).toHaveBeenCalledWith(12);
  });

  it.each(['liberado', 'aguardando_consentimento', 'bloqueado'] as const)(
    'entrega o acesso %s devolvido pela regra',
    async (acesso) => {
      mockGetTaskAccess.mockResolvedValue(acesso);

      const { result } = renderHook(() => useConsentGate('12'));

      await waitFor(() => expect(result.current).toBe(acesso));
    },
  );

  it('bloqueia a rota se a consulta ao banco falhar', async () => {
    mockGetTaskAccess.mockRejectedValue(new Error('banco indisponível'));

    const { result } = renderHook(() => useConsentGate('12'));

    await waitFor(() => expect(result.current).toBe('bloqueado'));
  });

  it('consulta um id inválido quando o parâmetro está ausente', async () => {
    mockGetTaskAccess.mockResolvedValue('bloqueado');

    const { result } = renderHook(() => useConsentGate(undefined));

    await waitFor(() => expect(result.current).toBe('bloqueado'));
    expect(mockGetTaskAccess).toHaveBeenCalledWith(Number.NaN);
  });

  it('volta a carregar quando a rota muda para outro atendimento', async () => {
    mockGetTaskAccess.mockResolvedValueOnce('liberado');
    const { result, rerender } = renderHook(
      ({ atendimento }: { atendimento: string }) => useConsentGate(atendimento),
      { initialProps: { atendimento: '12' } },
    );
    await waitFor(() => expect(result.current).toBe('liberado'));
    mockGetTaskAccess.mockReturnValueOnce(new Promise(() => undefined));

    rerender({ atendimento: '13' });

    expect(result.current).toBe('carregando');
    expect(mockGetTaskAccess).toHaveBeenLastCalledWith(13);
  });
});
