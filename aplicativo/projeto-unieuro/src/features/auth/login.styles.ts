import { StyleSheet } from 'react-native';
import { FontFamilies, type ThemeColors } from '@/constants/theme';


const fonts = FontFamilies;

export function getLoginLayout(width: number, height: number) {
  const isTablet = width >= 700;
  const horizontalInset = isTablet ? Math.min(40, width * 0.05) : width < 360 ? 16 : 20;
  const cardWidth = Math.min(Math.max(0, width - horizontalInset * 2), isTablet ? 560 : 506);

  return {
    isTablet,
    horizontalInset,
    cardWidth,
    cardHorizontalPadding: Math.min(isTablet ? 56 : 24, Math.max(20, cardWidth * 0.1)),
    cardVerticalPadding: Math.min(52, Math.max(28, height * 0.065)),
    logoSize: isTablet ? 92 : 80,
    titleFontSize: isTablet ? 42 : width < 360 ? 32 : 36,
  };
}
export function createLoginStyles(colors: ThemeColors) {
  return StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  card: {
    width: '100%',
    maxWidth: 506,
    backgroundColor: colors.surface,
    borderRadius: 26,
    paddingHorizontal: '10%',
    paddingTop: 50,
    paddingBottom: 42,
    alignItems: 'center',
    boxShadow: '0px 10px 22px rgba(15, 23, 42, 0.08)',
  },
  logoPlaceholder: {
    width: 86,
    height: 86,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoMark: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 42, fontWeight: '700' },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 42,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  form: { width: '100%' },
  label: {
    color: colors.textSecondary,
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordLabel: { marginTop: 18 },
  input: {
    width: '100%',
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
    paddingHorizontal: 22,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  loginButton: {
    minHeight: 68,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  loginText: { color: colors.onPrimary, fontFamily: fonts.semibold, fontSize: 21, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 10,
    columnGap: 8,
    rowGap: 4,
  },
  actionButton: {
    minHeight: 48,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  footnote: {
    color: colors.textSecondary,
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  pressed: { opacity: 0.78 },
  });
}