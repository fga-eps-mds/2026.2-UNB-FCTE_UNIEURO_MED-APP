import { StyleSheet } from 'react-native';

import { BrandPalette, FontFamilies, type ThemeColors } from '@/constants/theme';

/** Largura a partir da qual a lista mostra todas as colunas, como no tablet deitado. */
export const WIDE_LAYOUT_MIN_WIDTH = 900;

// Tamanhos do guia de identidade visual (DOCS, produto/identidade-visual.md)
// para as telas do profissional: o menor texto é 16, o corpo é 18 e o botão
// médio tem 64 de altura, com texto 20.
export function createHomeStyles(theme: ThemeColors) {
  const label = {
    color: theme.textSecondary,
    fontFamily: FontFamilies.semibold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
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
    brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logo: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
    },
    logoText: { color: theme.onPrimary, fontFamily: FontFamilies.bold, fontSize: 20 },
    brandName: {
      color: theme.text,
      fontFamily: FontFamilies.bold,
      fontSize: 16,
      letterSpacing: 0.6,
    },
    brandCaption: { ...label, marginTop: 2 },
    account: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    accountText: { alignItems: 'flex-end' },
    professionalName: { ...body, color: theme.text, fontFamily: FontFamilies.semibold },
    professionalCrm: { ...label, marginTop: 2 },
    body: { flex: 1, gap: 24, padding: 24 },
    bodyWide: { paddingHorizontal: 40, paddingTop: 32 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 16,
    },
    titleBlock: { flexShrink: 1, gap: 6 },
    title: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 34, lineHeight: 42 },
    subtitle: { ...body, color: theme.textSecondary },
    toolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
    search: {
      ...body,
      flexGrow: 1,
      flexBasis: 320,
      minHeight: 60,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.field,
      color: theme.text,
    },
    toolbarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    primaryButton: { ...button, backgroundColor: theme.primary },
    primaryButtonText: { ...buttonText, color: theme.onPrimary },
    outlineButton: {
      ...button,
      borderWidth: 2,
      borderColor: theme.primary,
      backgroundColor: theme.surface,
    },
    outlineButtonText: { ...buttonText, color: theme.primary },
    disabledButton: { borderColor: theme.border, backgroundColor: theme.field },
    disabledButtonText: { color: theme.textSecondary },
    textButton: { ...button, minHeight: 48, paddingHorizontal: 12 },
    textButtonText: { ...buttonText, color: theme.primary },
    pressed: { opacity: 0.82 },
    listCard: {
      flex: 1,
      overflow: 'hidden',
      borderRadius: 24,
      backgroundColor: theme.surface,
    },
    columnHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    columnLabel: label,
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    rowMain: {
      flex: 1,
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    colName: { flex: 2.4 },
    colRecord: { flex: 1.1 },
    colLastExam: { flex: 1.4, alignItems: 'flex-start', gap: 4 },
    colCount: { flex: 0.6, textAlign: 'center' },
    patientName: { ...body, color: theme.text, fontFamily: FontFamilies.semibold },
    cell: { ...body, color: theme.text },
    cellSecondary: {
      color: theme.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 16,
      lineHeight: 24,
    },
    record: { ...body, color: theme.textSecondary },
    count: { ...body, color: theme.text, fontFamily: FontFamilies.semibold },
    chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    chipText: { fontFamily: FontFamilies.semibold, fontSize: 16, lineHeight: 22 },
    chipConcluido: { backgroundColor: theme.background },
    chipConcluidoText: { color: theme.text },
    chipInterrompido: { backgroundColor: BrandPalette.lightPeach },
    chipInterrompidoText: { color: theme.primary },
    chipRecusado: { backgroundColor: BrandPalette.cream },
    chipRecusadoText: { color: BrandPalette.deepWine },
    separator: { height: 1, marginHorizontal: 24, backgroundColor: theme.border },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    emptyIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BrandPalette.lightPeach,
    },
    emptyIconText: { color: theme.primary, fontFamily: FontFamilies.bold, fontSize: 36 },
    emptyTitle: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 24, lineHeight: 32 },
    emptyText: { ...body, color: theme.textSecondary, textAlign: 'center' },
    noResults: { ...body, padding: 32, color: theme.textSecondary, textAlign: 'center' },
  });
}

export type HomeStyles = ReturnType<typeof createHomeStyles>;
