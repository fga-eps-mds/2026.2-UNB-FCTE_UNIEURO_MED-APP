import { StyleSheet } from 'react-native';

import { BrandPalette, FontFamilies, type ThemeColors } from '@/constants/theme';

/** Campos, botões e diálogo da edição da conta e da desativação (#5). */
export function createAccountFormStyles(theme: ThemeColors) {
  const button = {
    minHeight: 52,
    flexGrow: 1,
    flexBasis: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 14,
  } as const;

  return StyleSheet.create({
    subtitle: {
      color: theme.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 15,
      lineHeight: 22,
      marginTop: -12,
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    field: { flexGrow: 1, flexBasis: 200, gap: 6 },
    label: {
      color: theme.textSecondary,
      fontFamily: FontFamilies.semibold,
      fontSize: 11,
      letterSpacing: 0.9,
    },
    input: {
      minHeight: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.field,
      color: theme.text,
      fontFamily: FontFamilies.regular,
      fontSize: 16,
      paddingHorizontal: 16,
    },
    inputError: { borderColor: BrandPalette.deepWine, borderWidth: 2 },
    lockedInput: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 12,
      backgroundColor: theme.background,
      paddingHorizontal: 16,
    },
    lockedText: { color: theme.placeholder, fontFamily: FontFamilies.regular, fontSize: 16 },
    lockedHint: { color: theme.textSecondary, fontFamily: FontFamilies.regular, fontSize: 13 },
    error: { color: BrandPalette.deepWine, fontFamily: FontFamilies.semibold, fontSize: 13 },
    hint: { color: theme.textSecondary, fontFamily: FontFamilies.regular, fontSize: 13 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
    primaryButton: { ...button, backgroundColor: theme.primary },
    primaryButtonText: { color: theme.onPrimary, fontFamily: FontFamilies.semibold, fontSize: 16 },
    secondaryButton: { ...button, borderWidth: 1.5, borderColor: theme.primary },
    secondaryButtonText: { color: theme.primary, fontFamily: FontFamilies.semibold, fontSize: 16 },
    dangerButton: { ...button, backgroundColor: BrandPalette.deepWine },
    dangerButtonText: { color: '#FFFFFF', fontFamily: FontFamilies.semibold, fontSize: 16 },
    linkButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
    dangerLinkText: {
      color: BrandPalette.deepWine,
      fontFamily: FontFamilies.semibold,
      fontSize: 15,
    },
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    dialog: {
      width: '100%',
      maxWidth: 560,
      gap: 16,
      padding: 32,
      borderRadius: 20,
      backgroundColor: theme.surface,
    },
    dialogTitle: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 22 },
    dialogText: {
      color: theme.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 15,
      lineHeight: 22,
    },
    disabled: { opacity: 0.6 },
  });
}

export type AccountFormStyles = ReturnType<typeof createAccountFormStyles>;
