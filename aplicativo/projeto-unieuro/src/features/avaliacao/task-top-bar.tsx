import { useMemo } from 'react';
import { Text, View } from 'react-native';

import type { ThemeColors } from '@/constants/theme';
import { createInstructionStyles } from '@/features/avaliacao/instruction.styles';
import { TOTAL_TAREFAS } from '@/features/avaliacao/tarefas';

export const HELP_MESSAGE = 'Se precisar de ajuda, chame o profissional';

export type TaskTopBarProps = {
  /** Tarefa atual, de 1 a 3. */
  numero: number;
  cores: ThemeColors;
};

/**
 * Barra superior das telas do paciente durante as tarefas, na instrução (#8) e no
 * desenho (#9): um círculo por tarefa, o texto "Tarefa N de 3" e a frase de ajuda
 * (guia de identidade visual, "Telas do paciente").
 */
export function TaskTopBar({ numero, cores }: Readonly<TaskTopBarProps>) {
  const styles = useMemo(() => createInstructionStyles(cores), [cores]);

  return (
    <View style={styles.topBar}>
      <View style={styles.progress}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.dots}>
          {Array.from({ length: TOTAL_TAREFAS }, (_, indice) => (
            <View key={indice} style={[styles.dot, indice < numero && styles.dotFilled]} />
          ))}
        </View>
        <Text style={styles.progressText}>{`Tarefa ${numero} de ${TOTAL_TAREFAS}`}</Text>
      </View>
      <Text style={styles.help}>{HELP_MESSAGE}</Text>
    </View>
  );
}
