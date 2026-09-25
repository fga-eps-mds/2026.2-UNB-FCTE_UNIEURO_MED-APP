import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme');

const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe('useTheme', () => {
  it('devolve a paleta clara quando nenhum modo é informado', () => {
    mockedUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useTheme());

    expect(result.current).toBe(Colors.light);
  });

  it('devolve a paleta escura quando o modo escuro é pedido explicitamente', () => {
    mockedUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useTheme('dark'));

    expect(result.current).toBe(Colors.dark);
  });

  it('ignora o esquema do sistema quando o modo é fixo', () => {
    mockedUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useTheme('light'));

    expect(result.current).toBe(Colors.light);
  });

  it('segue o esquema do sistema no modo "system"', () => {
    mockedUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useTheme('system'));

    expect(result.current).toBe(Colors.dark);
  });

  it('cai na paleta clara quando o sistema não informa esquema', () => {
    mockedUseColorScheme.mockReturnValue(null);

    const { result } = renderHook(() => useTheme('system'));

    expect(result.current).toBe(Colors.light);
  });
});
