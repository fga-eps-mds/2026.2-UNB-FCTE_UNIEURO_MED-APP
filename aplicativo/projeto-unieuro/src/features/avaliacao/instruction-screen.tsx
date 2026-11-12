import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { returnToLogin, useSession } from '@/features/auth/session';
import {
  TAMANHO_ICONE_TAREFA,
  createInstructionStyles,
  getInstructionLayout,
} from '@/features/avaliacao/instruction.styles';
import {
  obterTarefa,
  TOTAL_TAREFAS,
  valorDoParametro,
  type ParametroDeRota,
  type Tarefa,
} from '@/features/avaliacao/tarefas';
import type { MotivoDesistencia } from '@/features/avaliacao/interrupcao';
import { TaskTopBar } from '@/features/avaliacao/task-top-bar';
import { useSemVoltar } from '@/features/avaliacao/use-sem-voltar';
import { useTheme } from '@/hooks/use-theme';

export { HELP_MESSAGE } from '@/features/avaliacao/task-top-bar';

export type InstructionScreenProps = {
  /** Parâmetro `tarefa` da rota: 1, 2 ou 3. */
  tarefa: ParametroDeRota;
  /** Parâmetro `atendimento` da rota: a avaliação em andamento. */
  atendimento: ParametroDeRota;
  onStart: (tarefa: Tarefa) => void;
  /** Grava a desistência na tarefa atual (#25) e decide o destino. */
  onDesistir?: (tarefa: Tarefa, motivo: MotivoDesistencia | null) => Promise<void>;
};

/**
 * Instrução simples que o paciente vê antes de cada desenho (#8). Mostra em qual
 * das três tarefas ele está, o que fazer e o botão "Começar". A área de desenho
 * só abre depois do toque, por isso esta tela não a contém: ela entrega o toque a
 * `onStart` e quem navega decide o destino.
 *
 * Sem médico logado, volta ao login. Sem avaliação em andamento ou com uma tarefa
 * que não existe, volta ao início. O botão voltar do Android não sai da avaliação.
 *
 * As medidas do cartão acompanham o tamanho da tela (#109). No tablet, deitado ou em
 * pé, tudo cabe sem rolar; numa tela pequena, como a de um celular, a tela rola em vez
 * de cortar a instrução ou o botão.
 */
export default function InstructionScreen({
  tarefa: tarefaParam,
  atendimento,
  onStart,
  onDesistir,
}: Readonly<InstructionScreenProps>) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => getInstructionLayout(width, height), [width, height]);
  const styles = useMemo(() => createInstructionStyles(theme, layout), [theme, layout]);
  useSemVoltar();

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
      <TaskTopBar
        numero={tarefa.numero}
        cores={theme}
        onDesistir={onDesistir && ((motivo) => onDesistir(tarefa, motivo))}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View testID="cartao-instrucao" style={styles.card}>
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
