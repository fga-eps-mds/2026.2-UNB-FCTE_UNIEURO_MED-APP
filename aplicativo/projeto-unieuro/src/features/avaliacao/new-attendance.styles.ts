import { StyleSheet } from 'react-native';

import { BrandPalette, FontFamilies, type ThemeColors } from '@/constants/theme';

const fonts = FontFamilies;

/** Largura a partir da qual os campos ficam em duas linhas  */
export const WIDE_LAYOUT_MIN_WIDTH = 760;

// Largura máxima do conteúdo
export const MAX_CONTENT_WIDTH = 1040;

export function getNewAttendanceLayout(width: number, height: number) {
  const isWide = width >= WIDE_LAYOUT_MIN_WIDTH;
  const horizontalInset = isWide ? Math.min(40, width * 0.04) : width < 360 ? 16 : 20;
  const contentWidth = Math.min(Math.max(0, width - horizontalInset * 2), MAX_CONTENT_WIDTH);

  return {
    isWide,
    horizontalInset,
    verticalInset: height < 700 ? 16 : 32,
    contentWidth,
    cardPadding: isWide ? 32 : 20,
    titleFontSize: isWide ? 34 : 28,
  };
}

// o menor texto é 16, o corpo é 18 e o botão
// médio tem 64 de altura, com texto 20.
export function createNewAttendanceStyles(colors: ThemeColors) {
  const label = {
    color: colors.textSecondary,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: 0.64,
    textTransform: 'uppercase' as const,
  };
  const body = { fontFamily: fonts.regular, fontSize: 18, lineHeight: 26 };
  const field = {
    minHeight: 60,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.field,
    paddingHorizontal: 14,
  };
  const button = {
    minHeight: 64,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
    borderRadius: 16,
  };
  const buttonText = { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 };

  return StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, alignItems: 'center' },
    content: { width: '100%', gap: 24 },
    header: { gap: 6 },
    title: { color: colors.text, fontFamily: fonts.bold, fontWeight: '700' },
    subtitle: { ...body, color: colors.textSecondary },
    card: {
      width: '100%',
      gap: 20,
      borderRadius: 24,
      backgroundColor: colors.surface,
      boxShadow: '0px 10px 22px rgba(15, 23, 42, 0.08)',
    },
    sectionTitle: { ...label, color: colors.primary },
    fieldRow: { width: '100%', gap: 16 },
    fieldRowWide: { flexDirection: 'row', alignItems: 'flex-start' },
    fieldRowNarrow: { flexDirection: 'column' },
    field: { gap: 8, minWidth: 0 },
    fieldWide: { flex: 1 },
    fieldWideName: { flex: 1.6 },
    label,
    input: { ...field, ...body, width: '100%', color: colors.text },
    inputFocused: { borderColor: colors.primary, borderWidth: 2 },
    inputInvalid: { borderColor: BrandPalette.deepWine, borderWidth: 2 },
    select: {
      ...field,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    selectText: { ...body, flexShrink: 1, color: colors.text },
    selectPlaceholder: { color: colors.placeholder },
    selectChevron: { ...body, color: colors.textSecondary },
    errorText: {
      color: BrandPalette.deepWine,
      fontFamily: fonts.semibold,
      fontSize: 16,
      lineHeight: 22,
    },
    professional: {
      gap: 8,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    professionalWide: { flexDirection: 'row', alignItems: 'baseline', gap: 16 },
    professionalText: { ...body, flexShrink: 1, color: colors.text },
    submitButton: { ...button, backgroundColor: colors.primary },
    submitButtonWide: { alignSelf: 'flex-end' },
    submitButtonNarrow: { alignSelf: 'stretch' },
    submitText: { ...buttonText, color: colors.onPrimary, textAlign: 'center' },
    pressed: { opacity: 0.82 },
    modalOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: 'rgba(15, 23, 42, 0.5)',
    },
    modalSheet: {
      width: '100%',
      maxWidth: 480,
      gap: 16,
      padding: 24,
      borderRadius: 24,
      backgroundColor: colors.surface,
    },
    modalTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 24, lineHeight: 32 },
    option: {
      ...button,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    optionSelected: { backgroundColor: BrandPalette.lightPeach },
    optionText: { ...buttonText, color: colors.primary },
    cancelButton: { ...button, minHeight: 48, paddingHorizontal: 12 },
    cancelText: { ...buttonText, color: colors.textSecondary },
  });
}

export type NewAttendanceStyles = ReturnType<typeof createNewAttendanceStyles>;
