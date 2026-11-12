import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ThemeColors } from '@/constants/theme';
import { DesistirDialog } from '@/features/avaliacao/desistir-dialog';
import { createInstructionStyles } from '@/features/avaliacao/instruction.styles';
import type { MotivoDesistencia } from '@/features/avaliacao/interrupcao';
import { createInterrupcaoStyles } from '@/features/avaliacao/interrupcao.styles';
import { obterTarefa, TOTAL_TAREFAS } from '@/features/avaliacao/tarefas';

export const HELP_MESSAGE = 'Se precisar de ajuda, chame o profissional';

export type TaskTopBarProps = {
  /** Tarefa atual, de 1 a 3. */
  numero: number;
  cores: ThemeColors;
  /** Grava a desistência na tarefa atual (#25). Sem ela, a barra não mostra o "Desistir". */
  onDesistir?: (motivo: MotivoDesistencia | null) => Promise<void>;
};

/**
 * Barra superior das telas do paciente durante as tarefas, na instrução (#8) e no
 * desenho (#9): um círculo por tarefa, o texto "Tarefa N de 3" e a frase de ajuda
 * (guia de identidade visual, "Telas do paciente").
 */
export function TaskTopBar({ numero, cores, onDesistir }: Readonly<TaskTopBarProps>) {
  const styles = useMemo(() => createInstructionStyles(cores), [cores]);
  const interrupcao = useMemo(() => createInterrupcaoStyles(), []);
  const [desistindo, setDesistindo] = useState(false);
  const progresso = `Tarefa ${numero} de ${TOTAL_TAREFAS}`;
  const titulo = obterTarefa(String(numero))?.titulo;

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
        <Text style={styles.progressText}>{progresso}</Text>
      </View>
      <Text style={styles.help}>{HELP_MESSAGE}</Text>
      {onDesistir && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Desistir do exame"
            onPress={() => setDesistindo(true)}
            style={({ pressed }) => [interrupcao.desistir, pressed && interrupcao.pressionado]}>
            <Text style={interrupcao.desistirTexto}>Desistir</Text>
          </Pressable>
          <DesistirDialog
            visible={desistindo}
            parouEm={titulo ? `${progresso} · ${titulo}` : progresso}
            onContinuar={() => setDesistindo(false)}
            onDesistir={onDesistir}
          />
        </>
      )}
    </View>
  );
}
