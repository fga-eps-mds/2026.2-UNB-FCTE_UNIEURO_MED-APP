import { StyleSheet } from 'react-native';

import { BrandPalette, FontFamilies, type ThemeColors } from '@/constants/theme';

// Mesmos tamanhos da tela inicial, do guia de identidade visual: o menor
// texto é 16, o corpo é 18 e o botão médio tem 64 de altura, com texto 20.
export function createSettingsStyles(theme: ThemeColors) {
  const label = {
    color: theme.textSecondary,
    fontFamily: FontFamilies.semibold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.64,
  };
  const body = { fontFamily: FontFamilies.regular, fontSize: 18, lineHeight: 28 };
  const buttonText = { fontFamily: FontFamilies.semibold, fontSize: 20, lineHeight: 26 };

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
    back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
    backText: { ...buttonText, color: theme.primary },
    accountText: { alignItems: 'flex-end' },
    professionalName: { ...body, color: theme.text, fontFamily: FontFamilies.semibold },
    label: { ...label, marginTop: 2 },
    content: { gap: 24, padding: 24, paddingBottom: 48 },
    contentWide: { paddingHorizontal: 40, paddingTop: 32 },
    title: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 34, lineHeight: 42 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
    card: {
      flexGrow: 1,
      flexBasis: 320,
      gap: 16,
      padding: 32,
      borderRadius: 24,
      backgroundColor: theme.surface,
    },
    cardTitle: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 24, lineHeight: 32 },
    field: { gap: 8 },
    fieldLabel: label,
    value: { ...body, color: theme.text, fontFamily: FontFamilies.semibold },
    description: { ...body, color: theme.textSecondary },
    dangerButton: {
      minHeight: 64,
      alignSelf: 'flex-start',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: BrandPalette.deepWine,
    },
    dangerButtonText: { ...buttonText, color: BrandPalette.deepWine },
    pressed: { opacity: 0.82 },
  });
}

export type SettingsStyles = ReturnType<typeof createSettingsStyles>;
