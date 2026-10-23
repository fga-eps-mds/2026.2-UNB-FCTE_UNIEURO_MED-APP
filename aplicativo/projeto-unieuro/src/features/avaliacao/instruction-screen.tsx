import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { returnToLogin, useSession } from '@/features/auth/session';
import {
  TAMANHO_ICONE_TAREFA,
  createInstructionStyles,
} from '@/features/avaliacao/instruction.styles';
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
  const styles = useMemo(() => createInstructionStyles(theme), [theme]);

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
              size={TAMANHO_ICONE_TAREFA}
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
