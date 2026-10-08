import '@/global.css';

export const BrandPalette = {
  mnemaOrange: '#9A3412',
  deepWine: '#7F1D1D',
  lightPeach: '#FFE8D6',
  cream: '#FEF3C7',
  midnight: '#0F172A',
  white: '#FFFFFF',
} as const;

export const Colors = {
  light: {
    primary: '#9A3412',
    onPrimary: '#ffffff',
    text: '#0F172A',
    textSecondary: '#475569',
    background: '#E9ECFA',
    surface: '#ffffff',
    field: '#F3F4FB',
    border: '#C7D2E5',
    placeholder: '#94A3B8',
    error: '#B91C1C',
    errorBg: '#FEE2E2',
    success: '#166534',
    successBg: '#DCFCE7',
    info: '#1E40AF',
    infoBg: '#DBEAFE',
  },
  dark: {
    primary: '#9A3412',
    onPrimary: '#ffffff',
    text: '#ffffff',
    textSecondary: '#CBD5E1',
    background: '#0F172A',
    surface: '#1E293B',
    field: '#334155',
    border: '#475569',
    placeholder: '#CBD5E1',
    error: '#FCA5A5',
    errorBg: '#7F1D1D',
    success: '#86EFAC',
    successBg: '#14532D',
    info: '#93C5FD',
    infoBg: '#1E3A8A',
  },
} as const;

export type ThemeColors = (typeof Colors)[keyof typeof Colors];
export type ThemeMode = 'system' | keyof typeof Colors;

export const FontFamilies = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;
