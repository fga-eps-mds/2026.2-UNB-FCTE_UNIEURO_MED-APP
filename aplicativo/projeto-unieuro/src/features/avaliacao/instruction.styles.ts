import { StyleSheet } from 'react-native';

import { BrandPalette, FontFamilies, type ThemeColors } from '@/constants/theme';

/** Estilos da tela de instrução (#8), uma tela do paciente: texto de 20 pontos ou mais. */
export function createInstructionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      paddingHorizontal: 24,
      paddingVertical: 20,
      backgroundColor: colors.surface,
    },
    progress: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dots: { flexDirection: 'row', gap: 8 },
    dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.border },
    dotFilled: { backgroundColor: colors.primary },
    progressText: {
      color: colors.text,
      fontFamily: FontFamilies.bold,
      fontSize: 22,
      lineHeight: 28,
    },
    help: {
      flexShrink: 1,
      color: colors.textSecondary,
      fontFamily: FontFamilies.semibold,
      fontSize: 20,
      lineHeight: 26,
      textAlign: 'right',
    },
    content: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    card: {
      width: '100%',
      maxWidth: 880,
      alignItems: 'center',
      gap: 20,
      paddingHorizontal: 40,
      paddingVertical: 48,
      borderRadius: 32,
      backgroundColor: colors.surface,
    },
    iconCircle: {
      width: 120,
      height: 120,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 60,
      backgroundColor: BrandPalette.lightPeach,
    },
    cardLabel: {
      color: colors.primary,
      fontFamily: FontFamilies.semibold,
      fontSize: 20,
      lineHeight: 26,
    },
    title: {
      color: colors.text,
      fontFamily: FontFamilies.bold,
      fontSize: 48,
      lineHeight: 58,
      textAlign: 'center',
    },
    instruction: {
      maxWidth: 760,
      color: colors.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 26,
      lineHeight: 38,
      textAlign: 'center',
    },
    button: {
      width: '100%',
      maxWidth: 520,
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: colors.primary,
    },
    buttonText: {
      color: colors.onPrimary,
      fontFamily: FontFamilies.bold,
      fontSize: 26,
      lineHeight: 34,
    },
    pressed: { opacity: 0.85 },
  });
}
