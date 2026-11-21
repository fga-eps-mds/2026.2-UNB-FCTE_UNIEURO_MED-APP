import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FontFamilies, type ThemeColors } from '@/constants/theme';
import type { ExamTone } from '@/features/home/patients';
import { useTheme } from '@/hooks/use-theme';

// Ícones das mensagens do guia de identidade visual: a situação do exame nunca
// depende só da cor.
const ICON = {
  success: 'check-circle',
  warning: 'alert',
  error: 'close-circle',
  info: 'information',
} as const satisfies Record<ExamTone, string>;

function createChipStyles(theme: ThemeColors) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    text: { fontFamily: FontFamilies.semibold, fontSize: 16, lineHeight: 22 },
    success: { backgroundColor: theme.successBg },
    warning: { backgroundColor: theme.warningBg },
    error: { backgroundColor: theme.errorBg },
    info: { backgroundColor: theme.infoBg },
  });
}

type ExamStatusChipProps = {
  tone: ExamTone;
  /** Texto da situação, como "Concluído". */
  label: string;
};

/**
 * Situação do exame com cor, ícone e texto, na lista de pacientes e na tela do
 * paciente. O ícone fica oculto para o leitor de tela, que lê só o texto.
 */
export default function ExamStatusChip({ tone, label }: ExamStatusChipProps) {
  const theme = useTheme();
  const styles = useMemo(() => createChipStyles(theme), [theme]);
  const color = theme[tone];

  return (
    <View testID="situacao" style={[styles.chip, styles[tone]]}>
      <MaterialCommunityIcons
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        name={ICON[tone]}
        size={20}
        color={color}
      />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}
