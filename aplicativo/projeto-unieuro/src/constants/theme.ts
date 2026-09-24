import '@/global.css';

export const BrandColors = {
  mnemaOrange: '#9A3412',
  deepWine: '#7F1D1D',
  lightPeach: '#FFE8D6',
  cream: '#FEF3C7',
  midnight: '#0F172A',
  white: '#FFFFFF',
} as const;

export const Colors = {
  light: {
    primary: BrandColors.mnemaOrange,
    primaryStrong: BrandColors.deepWine,
    onPrimary: BrandColors.white,
    text: BrandColors.midnight,
    textSecondary: BrandColors.midnight,
    background: BrandColors.white,
    surface: BrandColors.white,
    field: BrandColors.lightPeach,
    border: BrandColors.midnight,
    placeholder: BrandColors.midnight,
    accentSurface: BrandColors.cream,
  },
  dark: {
    primary: BrandColors.mnemaOrange,
    primaryStrong: BrandColors.deepWine,
    onPrimary: BrandColors.white,
    text: BrandColors.white,
    textSecondary: BrandColors.lightPeach,
    background: BrandColors.midnight,
    surface: BrandColors.deepWine,
    field: BrandColors.deepWine,
    border: BrandColors.lightPeach,
    placeholder: BrandColors.lightPeach,
    accentSurface: BrandColors.cream,
  },
} as const;

export type ThemeColors = (typeof Colors)[keyof typeof Colors];

export const FontFamilies = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;
