import { StyleSheet } from 'react-native';
import { FontFamilies, type ThemeColors } from '@/constants/theme';
import { createRegisterStyles } from '@/features/auth/register.styles';

export function createRecoveryStyles(colors: ThemeColors) {
  return {
    ...createRegisterStyles(colors),
    ...StyleSheet.create({
      title: {
        color: colors.text,
        fontFamily: FontFamilies.bold,
        fontWeight: '700',
        textAlign: 'center',
      },
      subtitle: {
        color: colors.textSecondary,
        fontFamily: FontFamilies.regular,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 24,
      },
      help: {
        color: colors.textSecondary,
        fontFamily: FontFamilies.regular,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
      },
      fieldError: {
        color: colors.error,
        fontFamily: FontFamilies.semibold,
        fontSize: 13,
        lineHeight: 19,
      },
      banner: {
        width: '100%',
        backgroundColor: colors.errorBg,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
      },
      bannerText: {
        color: colors.error,
        fontFamily: FontFamilies.semibold,
        fontSize: 13,
        lineHeight: 19,
      },
    }),
  };
}
