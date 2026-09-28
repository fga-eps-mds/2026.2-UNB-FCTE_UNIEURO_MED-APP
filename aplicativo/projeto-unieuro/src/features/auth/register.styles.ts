import { StyleSheet } from 'react-native';

import { FontFamilies, type ThemeColors } from '@/constants/theme';

const fonts = FontFamilies;

export function getRegisterLayout(width: number, height: number) {
  const isTablet = width >= 680;
  const horizontalInset = isTablet ? Math.min(40, width * 0.05) : width < 360 ? 16 : 20;
  const cardWidth = Math.min(Math.max(0, width - horizontalInset * 2), isTablet ? 720 : 506);

  return {
    isTablet,
    horizontalInset,
    cardWidth,
    cardHorizontalPadding: Math.min(isTablet ? 44 : 24, Math.max(20, cardWidth * 0.08)),
    cardVerticalPadding: Math.min(48, Math.max(28, height * 0.055)),
    logoSize: isTablet ? 64 : 72,
    titleFontSize: isTablet ? 32 : width < 360 ? 28 : 30,
  };
}

export function createRegisterStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      width: '100%',
      backgroundColor: colors.surface,
      alignItems: 'center',
      boxShadow: '0px 10px 22px rgba(15, 23, 42, 0.08)',
    },
    logoPlaceholder: {
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoMark: {
      color: colors.onPrimary,
      fontFamily: fonts.bold,
      fontSize: 30,
      fontWeight: '700',
    },
    title: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontWeight: '700',
      marginTop: 18,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 24,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 22,
    },
    form: {
      width: '100%',
      gap: 18,
    },
    fieldRow: {
      width: '100%',
      gap: 18,
    },
    fieldRowTablet: {
      flexDirection: 'row',
    },
    fieldRowPhone: {
      flexDirection: 'column',
    },
    field: {
      flex: 1,
      minWidth: 0,
      gap: 7,
    },
    label: {
      color: colors.textSecondary,
      fontFamily: fonts.semibold,
      fontSize: 13,
      fontWeight: '600',
    },
    input: {
      width: '100%',
      minHeight: 54,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.field,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: 16,
      paddingHorizontal: 16,
    },
    inputFocused: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    submitButton: {
      minHeight: 64,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    submitText: {
      color: colors.onPrimary,
      fontFamily: fonts.semibold,
      fontSize: 20,
      fontWeight: '600',
    },
    backButton: {
      minHeight: 48,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    backText: {
      color: colors.primary,
      fontFamily: fonts.semibold,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    pressed: { opacity: 0.78 },
  });
}