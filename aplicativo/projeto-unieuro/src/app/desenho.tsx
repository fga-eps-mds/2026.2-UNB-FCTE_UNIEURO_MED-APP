import { useLocalSearchParams, useRouter } from 'expo-router';

import DrawingTaskScreen from '@/features/avaliacao/drawing-task-screen';
import { TOTAL_TAREFAS } from '@/features/avaliacao/tarefas';

// Área de desenho de cada tarefa (#9).
//
// O "Confirmar" abre a instrução da tarefa seguinte e, depois das trilhas, a tela
// final do paciente (#11). O `replace` mantém o fluxo só para a frente: o paciente
// não volta a uma tarefa já confirmada.
export default function DrawingRoute() {
  const router = useRouter();
  const { atendimento, tarefa } = useLocalSearchParams<{ atendimento?: string; tarefa?: string }>();

  return (
    <DrawingTaskScreen
      tarefa={tarefa}
      atendimento={atendimento}
      onConfirmar={(confirmada) => {
        if (confirmada.numero === TOTAL_TAREFAS) {
          router.replace('/fim-do-teste');
          return;
        }
        router.replace({
          pathname: '/instrucao',
          params: { atendimento: String(atendimento), tarefa: String(confirmada.numero + 1) },
        });
      }}
    />
  );
}
