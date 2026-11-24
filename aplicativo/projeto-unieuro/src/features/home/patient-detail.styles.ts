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
    examRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 16,
      rowGap: 8,
      minHeight: 72,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    // A parte lida de uma vez pelo leitor de tela; o botão de marcar fica fora dela.
    exam: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 320,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: 16,
      rowGap: 8,
    },
    examChips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    // Marcação de teste ou ensino (#58): cinza, para não se confundir com a situação.
    markingChip: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.textSecondary,
      backgroundColor: theme.field,
    },
    markingText: {
      color: theme.textSecondary,
      fontFamily: FontFamilies.semibold,
      fontSize: 16,
      lineHeight: 22,
    },
    markButton: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.primary,
    },
    markButtonText: { color: theme.primary, fontFamily: FontFamilies.semibold, fontSize: 16 },
    // Exame com resultado: a parte do exame é o botão que abre o resultado (#14).
    pressed: { opacity: 0.82 },
    examWhen: { flexShrink: 1, gap: 2 },
    examDate: { ...body, color: theme.text, fontFamily: FontFamilies.semibold },
    examBy: {
      color: theme.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 16,
      lineHeight: 24,
    },
    state: { alignItems: 'center', gap: 12, padding: 32 },
    stateTitle: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 24, lineHeight: 32 },
    stateText: { ...body, color: theme.textSecondary, textAlign: 'center' },
  });
}

export type PatientDetailStyles = ReturnType<typeof createPatientDetailStyles>;
