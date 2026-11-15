import { StyleSheet } from 'react-native';

import { BrandPalette, FontFamilies, type ThemeColors } from '@/constants/theme';

/** Largura a partir da qual a lista mostra todas as colunas, como no tablet deitado. */
export const WIDE_LAYOUT_MIN_WIDTH = 900;

// Proporções do protótipo do Figma para o tablet deitado (tela 30, #49), sem
// descer do menor texto do guia de identidade visual (DOCS,
// produto/identidade-visual.md): 16.
export function createHomeStyles(theme: ThemeColors) {
  const label = {
    color: theme.textSecondary,
    fontFamily: FontFamilies.semibold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: 0.64,
  };
  const body = { fontFamily: FontFamilies.regular, fontSize: 16, lineHeight: 24 };
  const button = {
    minHeight: 56,
    flexDirection: 'row' as const,
    gap: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
    borderRadius: 12,
  };
  const buttonText = { fontFamily: FontFamilies.semibold, fontSize: 18, lineHeight: 24 };

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    // Aviso rápido no rodapé, no mesmo formato da confirmação do cadastro.
    noticePosition: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 24,
      alignItems: 'center',
      paddingHorizontal: 24,
      zIndex: 2,
      elevation: 4,
    },
    noticeBody: { width: '100%', maxWidth: 560 },
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
    brandName: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 20 },
    // O nome do profissional encolhe e vira reticências, para não empurrar os
    // botões de configurações e de sair para fora da tela (#97).
    account: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    accountText: { flexShrink: 1, alignItems: 'flex-end' },
    professionalName: { ...body, color: theme.text, fontFamily: FontFamilies.semibold },
    professionalCrm: { ...body, color: theme.textSecondary },
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
    title: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 30, lineHeight: 38 },
    subtitle: { ...body, color: theme.textSecondary },
    toolbarBlock: { gap: 8 },
    searchLabel: label,
    toolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
    search: {
      flexGrow: 1,
      flexBasis: 320,
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.textSecondary,
      backgroundColor: theme.field,
    },
    searchInput: { ...body, flex: 1, minHeight: 52, color: theme.text },
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
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 28,
      backgroundColor: theme.surface,
    },
    columnHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    columnLabel: label,
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingVertical: 2,
    },
    rowMain: {
      flex: 1,
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      borderRadius: 12,
    },
    colName: { flex: 2.4 },
    colRecord: { flex: 1.1 },
    colAttendedBy: { flex: 1.8 },
    colLastExam: { flex: 1.4, alignItems: 'flex-start', gap: 4 },
    // No tablet deitado, a situação fica ao lado da data, como no protótipo.
    colLastExamWide: { flex: 2.4, flexDirection: 'row', alignItems: 'center', gap: 12 },
    chevron: { width: 24 },
    colCount: { flex: 0.6 },
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
    separator: { height: 1, backgroundColor: theme.border },
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
