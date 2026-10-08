import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FontFamilies, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FeedbackKind = 'error' | 'success' | 'info';

type FeedbackMessageProps = {
  kind: FeedbackKind;
  message: string;
  inline?: boolean;
};

const feedback = {
  error: { label: 'Erro', icon: '⊗' },
  success: { label: 'Sucesso', icon: '✓' },
  info: { label: 'Informação', icon: 'ⓘ' },
} as const;

function createFeedbackStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    inline: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      marginTop: 4,
    },
    error: { backgroundColor: colors.errorBg },
    success: { backgroundColor: colors.successBg },
    info: { backgroundColor: colors.infoBg },
    icon: {
      width: 22,
      marginRight: 6,
      fontSize: 20,
      lineHeight: 24,
      fontFamily: FontFamilies.semibold,
    },
    text: { flex: 1, fontSize: 16, lineHeight: 24, fontFamily: FontFamilies.regular },
    errorText: { color: colors.error },
    successText: { color: colors.success },
    infoText: { color: colors.info },
  });
}

export function FeedbackMessage({ kind, message, inline = false }: FeedbackMessageProps) {
  const colors = useTheme();
  const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  const tone =
    kind === 'error' ? styles.errorText : kind === 'success' ? styles.successText : styles.infoText;

  return (
    <View
      accessible
      accessibilityLabel={`${feedback[kind].label}. ${message}`}
      accessibilityLiveRegion={kind === 'error' ? 'assertive' : 'polite'}
      style={[styles.container, inline ? styles.inline : styles[kind]]}>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.icon, tone]}>
        {feedback[kind].icon}
      </Text>
      <Text style={[styles.text, tone]}>{message}</Text>
    </View>
  );
}
