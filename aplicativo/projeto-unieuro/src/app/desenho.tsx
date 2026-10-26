import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import DrawingTaskScreen from '@/features/avaliacao/drawing-task-screen';
import { TOTAL_TAREFAS } from '@/features/avaliacao/tarefas';
import { useConsentGate } from '@/features/avaliacao/use-consent-gate';

// Área de desenho de cada tarefa (#9). Só abre com o consentimento gravado (#21):
// sem a decisão, volta ao termo; com a avaliação cancelada, volta ao início.
//
// O "Confirmar" abre a instrução da tarefa seguinte e, depois das trilhas, a tela
// final do paciente (#11). O `replace` mantém o fluxo só para a frente: o paciente
// não volta a uma tarefa já confirmada.
export default function DrawingRoute() {
  const router = useRouter();
  const { atendimento, tarefa } = useLocalSearchParams<{ atendimento?: string; tarefa?: string }>();
  const acesso = useConsentGate(atendimento);

  useEffect(() => {
    if (acesso === 'aguardando_consentimento') {
      router.replace({ pathname: '/tcle', params: { atendimento: String(atendimento) } });
    } else if (acesso === 'bloqueado') {
      router.replace('/menu');
    }
  }, [acesso, atendimento, router]);

  if (acesso !== 'liberado') return null;

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
