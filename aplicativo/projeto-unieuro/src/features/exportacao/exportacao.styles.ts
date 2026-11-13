import { StyleSheet } from 'react-native';

import { FontFamilies, type ThemeColors } from '@/constants/theme';

export function createExportacaoStyles(theme: ThemeColors) {
  const button = {
    flexGrow: 1,
    flexBasis: 200,
    minHeight: 60,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 20,
    borderRadius: 14,
  };
  const buttonText = { fontFamily: FontFamilies.semibold, fontSize: 18, lineHeight: 24 };

  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
    backdropContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    dialog: {
      width: '100%',
      maxWidth: 560,
      gap: 20,
      padding: 28,
      borderRadius: 20,
      backgroundColor: theme.surface,
    },
    title: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 24, lineHeight: 32 },
    text: {
      color: theme.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 18,
      lineHeight: 28,
    },
    destination: { gap: 4, padding: 16, borderRadius: 12, backgroundColor: theme.field },
    destinationLabel: {
      color: theme.textSecondary,
      fontFamily: FontFamilies.semibold,
      fontSize: 16,
      letterSpacing: 0.64,
    },
    destinationText: { color: theme.text, fontFamily: FontFamilies.semibold, fontSize: 18 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    secondaryButton: { ...button, borderWidth: 2, borderColor: theme.primary },
    secondaryButtonText: { ...buttonText, color: theme.primary },
    primaryButton: { ...button, backgroundColor: theme.primary },
    primaryButtonText: { ...buttonText, color: theme.onPrimary },
    pressed: { opacity: 0.82 },
  });
}
