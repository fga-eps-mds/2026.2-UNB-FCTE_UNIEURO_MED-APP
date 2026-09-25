import { Colors, type ThemeMode } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme(mode: ThemeMode = 'light') {
  const scheme = useColorScheme();
  const selectedMode = mode === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : mode;

  return Colors[selectedMode];
}