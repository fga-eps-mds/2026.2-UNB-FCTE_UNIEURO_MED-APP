import { StyleSheet } from 'react-native';

import { BrandPalette, FontFamilies, type ThemeColors } from '@/constants/theme';

export function createSettingsStyles(theme: ThemeColors) {
  const label = {
    color: theme.textSecondary,
    fontFamily: FontFamilies.semibold,
    fontSize: 11,
    letterSpacing: 0.9,
  };

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    topBar: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    topBarWide: { paddingHorizontal: 40 },
    back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
    backText: { color: theme.primary, fontFamily: FontFamilies.semibold, fontSize: 16 },
    accountText: { alignItems: 'flex-end' },
    professionalName: { color: theme.text, fontFamily: FontFamilies.semibold, fontSize: 15 },
    label: { ...label, marginTop: 2 },
    content: { gap: 20, padding: 20, paddingBottom: 40 },
    contentWide: { paddingHorizontal: 40, paddingTop: 28 },
    title: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 28 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
    card: {
      flexGrow: 1,
      flexBasis: 320,
      gap: 14,
      padding: 28,
      borderRadius: 20,
      backgroundColor: theme.surface,
    },
    cardTitle: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 18 },
    field: { gap: 4 },
    fieldLabel: label,
    value: { color: theme.text, fontFamily: FontFamilies.semibold, fontSize: 15 },
    description: { color: theme.textSecondary, fontFamily: FontFamilies.regular, fontSize: 14 },
    dangerButton: {
      minHeight: 48,
      alignSelf: 'flex-start',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: BrandPalette.deepWine,
    },
    dangerButtonText: {
      color: BrandPalette.deepWine,
      fontFamily: FontFamilies.semibold,
      fontSize: 15,
    },
    pressed: { opacity: 0.82 },
  });
}

export type SettingsStyles = ReturnType<typeof createSettingsStyles>;
