import { useMemo } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
  error: { label: 'Erro', icon: 'close-circle' },
  success: { label: 'Sucesso', icon: 'check-circle' },
  info: { label: 'Informação', icon: 'information' },
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
      width: 24,
      marginRight: 8,
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
  const iconColor = colors[kind];

  return (
    <View
      accessible
      accessibilityLabel={`${feedback[kind].label}. ${message}`}
      accessibilityLiveRegion={kind === 'error' ? 'assertive' : 'polite'}
      style={[styles.container, inline ? styles.inline : styles[kind]]}>
      <MaterialCommunityIcons
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        name={feedback[kind].icon}
        size={24}
        color={iconColor}
        style={styles.icon}
      />
      <Text style={[styles.text, tone]}>{message}</Text>
    </View>
  );
}
