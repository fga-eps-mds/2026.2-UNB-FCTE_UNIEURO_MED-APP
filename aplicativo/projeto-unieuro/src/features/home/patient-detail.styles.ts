import { StyleSheet } from 'react-native';

import { FontFamilies, type ThemeColors } from '@/constants/theme';

// Mesmos tamanhos da tela inicial (guia de identidade visual): o menor texto é
// 16 e o corpo é 18. Os chips de situação e a barra do topo vêm de `home.styles`.
export function createPatientDetailStyles(theme: ThemeColors) {
  const label = {
    color: theme.textSecondary,
    fontFamily: FontFamilies.semibold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: 0.64,
  };
  const body = { fontFamily: FontFamilies.regular, fontSize: 18, lineHeight: 28 };

  return StyleSheet.create({
    content: { gap: 24, padding: 24 },
    contentWide: { paddingHorizontal: 40, paddingTop: 32 },
    card: { gap: 20, padding: 32, borderRadius: 24, backgroundColor: theme.surface },
    patientName: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 34, lineHeight: 42 },
    facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 48, rowGap: 16 },
    fact: { gap: 2 },
    factLabel: label,
    factValue: { ...body, color: theme.text },
    examsHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 12 },
    examsTitle: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 24, lineHeight: 32 },
    examsSummary: { ...body, color: theme.textSecondary },
    exam: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: 16,
      rowGap: 8,
      minHeight: 72,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    examWhen: { flexShrink: 1, gap: 2 },
    examDate: { ...body, color: theme.text, fontFamily: FontFamilies.semibold },
    examBy: {
      color: theme.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 16,
      lineHeight: 24,
    },
    // Chip de situação: a cor acompanha o ícone e o texto, nunca vai sozinha.
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    chipText: { fontFamily: FontFamilies.semibold, fontSize: 16, lineHeight: 22 },
    chipSuccess: { backgroundColor: theme.successBg },
    chipSuccessText: { color: theme.success },
    chipWarning: { backgroundColor: theme.warningBg },
    chipWarningText: { color: theme.warning },
    chipError: { backgroundColor: theme.errorBg },
    chipErrorText: { color: theme.error },
    chipInfo: { backgroundColor: theme.infoBg },
    chipInfoText: { color: theme.info },
    state: { alignItems: 'center', gap: 12, padding: 32 },
    stateTitle: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 24, lineHeight: 32 },
    stateText: { ...body, color: theme.textSecondary, textAlign: 'center' },
  });
}

export type PatientDetailStyles = ReturnType<typeof createPatientDetailStyles>;
