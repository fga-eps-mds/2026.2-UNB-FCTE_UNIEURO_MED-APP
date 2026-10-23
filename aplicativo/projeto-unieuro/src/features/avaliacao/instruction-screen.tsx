import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamilies, type ThemeColors } from '@/constants/theme';
import { returnToLogin, useSession } from '@/features/auth/session';
import {
  obterTarefa,
  TOTAL_TAREFAS,
  valorDoParametro,
  type ParametroDeRota,
  type Tarefa,
} from '@/features/avaliacao/tarefas';
import { useTheme } from '@/hooks/use-theme';

export const HELP_MESSAGE = 'Se precisar de ajuda, chame o profissional';

export type InstructionScreenProps = {
  /** Parâmetro `tarefa` da rota: 1, 2 ou 3. */
  tarefa: ParametroDeRota;
  /** Parâmetro `atendimento` da rota: a avaliação em andamento. */
  atendimento: ParametroDeRota;
  onStart: (tarefa: Tarefa) => void;
};

/**
 * Instrução simples que o paciente vê antes de cada desenho (#8). Mostra em qual
 * das três tarefas ele está, o que fazer e o botão "Começar". A área de desenho
 * só abre depois do toque, por isso esta tela não a contém: ela entrega o toque a
 * `onStart` e quem navega decide o destino.
 *
 * Sem médico logado, volta ao login. Sem avaliação em andamento ou com uma tarefa
 * que não existe, volta ao início.
 */
export default function InstructionScreen({
  tarefa: tarefaParam,
  atendimento,
  onStart,
}: InstructionScreenProps) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const tarefa = obterTarefa(tarefaParam);
  const emAndamento = Boolean(valorDoParametro(atendimento));

  useEffect(() => {
    if (!professional) returnToLogin(router);
    else if (!tarefa || !emAndamento) router.replace('/menu');
  }, [professional, tarefa, emAndamento, router]);

  if (!professional || !tarefa || !emAndamento) return null;

  const progresso = `Tarefa ${tarefa.numero} de ${TOTAL_TAREFAS}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.progress}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.dots}>
            {Array.from({ length: TOTAL_TAREFAS }, (_, indice) => (
              <View key={indice} style={[styles.dot, indice < tarefa.numero && styles.dotFilled]} />
            ))}
          </View>
          <Text style={styles.progressText}>{progresso}</Text>
        </View>
        <Text style={styles.help}>{HELP_MESSAGE}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              name={tarefa.icone}
              size={56}
              color={theme.primary}
            />
          </View>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.cardLabel}>
            {progresso}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            {tarefa.titulo}
          </Text>
          <Text style={styles.instruction}>{tarefa.instrucao}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onStart(tarefa)}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Começar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      paddingHorizontal: 24,
      paddingVertical: 20,
      backgroundColor: colors.surface,
    },
    progress: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dots: { flexDirection: 'row', gap: 8 },
    dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.border },
    dotFilled: { backgroundColor: colors.primary },
    progressText: {
      color: colors.text,
      fontFamily: FontFamilies.bold,
      fontSize: 22,
      lineHeight: 28,
    },
    help: {
      flexShrink: 1,
      color: colors.textSecondary,
      fontFamily: FontFamilies.semibold,
      fontSize: 20,
      lineHeight: 26,
      textAlign: 'right',
    },
    content: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    card: {
      width: '100%',
      maxWidth: 880,
      alignItems: 'center',
      gap: 20,
      paddingHorizontal: 40,
      paddingVertical: 48,
      borderRadius: 32,
      backgroundColor: colors.surface,
    },
    iconCircle: {
      width: 120,
      height: 120,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 60,
      backgroundColor: '#FFE8D6',
    },
    cardLabel: {
      color: colors.primary,
      fontFamily: FontFamilies.semibold,
      fontSize: 20,
      lineHeight: 26,
    },
    title: {
      color: colors.text,
      fontFamily: FontFamilies.bold,
      fontSize: 48,
      lineHeight: 58,
      textAlign: 'center',
    },
    instruction: {
      maxWidth: 760,
      color: colors.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 26,
      lineHeight: 38,
      textAlign: 'center',
    },
    button: {
      width: '100%',
      maxWidth: 520,
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: colors.primary,
    },
    buttonText: {
      color: colors.onPrimary,
      fontFamily: FontFamilies.bold,
      fontSize: 26,
      lineHeight: 34,
    },
    pressed: { opacity: 0.85 },
  });
}
