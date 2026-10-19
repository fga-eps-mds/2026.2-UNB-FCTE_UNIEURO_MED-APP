import { StyleSheet } from 'react-native';

import { FontFamilies, type ThemeColors } from '@/constants/theme';

// Tamanhos do guia de identidade visual, como nas configurações.
export function createSyncStyles(theme: ThemeColors) {
  const label = {
    color: theme.textSecondary,
    fontFamily: FontFamilies.semibold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.64,
  };
  const body = { fontFamily: FontFamilies.regular, fontSize: 18, lineHeight: 28 };
  const button = {
    minHeight: 64,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
    borderRadius: 16,
  };
  const buttonText = { fontFamily: FontFamilies.semibold, fontSize: 20, lineHeight: 26 };

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    topBar: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      rowGap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    topBarWide: { paddingHorizontal: 40 },
    back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
    backText: { ...buttonText, color: theme.primary },
    account: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    accountText: { alignItems: 'flex-end' },
    professionalName: { ...body, color: theme.text, fontFamily: FontFamilies.semibold },
    professionalCrm: { ...label, marginTop: 2 },
    textButton: { ...button, minHeight: 48, paddingHorizontal: 12 },
    textButtonText: { ...buttonText, color: theme.primary },
    content: { gap: 24, padding: 24, paddingBottom: 48 },
    contentWide: { paddingHorizontal: 40, paddingTop: 32 },
    titleBlock: { gap: 6 },
    title: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 34, lineHeight: 42 },
    subtitle: { ...body, color: theme.textSecondary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 },
    mainColumn: { flexGrow: 3, flexBasis: 420, gap: 24 },
    sideColumn: { flexGrow: 2, flexBasis: 320, gap: 24 },
    card: { gap: 16, padding: 32, borderRadius: 24, backgroundColor: theme.surface },
    cardTitle: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 24, lineHeight: 32 },
    text: { ...body, color: theme.text },
    strong: { fontFamily: FontFamilies.semibold },
    hint: { ...body, fontSize: 16, lineHeight: 24, color: theme.textSecondary },
    field: { gap: 8 },
    fieldLabel: label,
    input: {
      ...body,
      minHeight: 60,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.field,
      color: theme.text,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    primaryButton: { ...button, backgroundColor: theme.primary },
    primaryButtonText: { ...buttonText, color: theme.onPrimary },
    outlineButton: {
      ...button,
      borderWidth: 2,
      borderColor: theme.primary,
      backgroundColor: theme.surface,
    },
    outlineButtonText: { ...buttonText, color: theme.primary },
    disabledButton: { opacity: 0.6 },
    pressed: { opacity: 0.82 },
    codeBox: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 20,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor: theme.background,
    },
    code: {
      color: theme.text,
      fontFamily: FontFamilies.bold,
      fontSize: 32,
      lineHeight: 40,
      letterSpacing: 2,
    },
    digits: {
      color: theme.text,
      fontFamily: FontFamilies.bold,
      fontSize: 48,
      lineHeight: 56,
      letterSpacing: 12,
    },
    endpoints: { gap: 12 },
    footer: { ...body, fontSize: 16, lineHeight: 24, color: theme.textSecondary },
  });
}

export type SyncStyles = ReturnType<typeof createSyncStyles>;
