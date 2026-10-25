import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import DrawingPlaceholderScreen from '@/features/avaliacao/drawing-placeholder-screen';
import DrawingTaskScreen from '@/features/avaliacao/drawing-task-screen';
import { temTelaDeDesenho } from '@/features/avaliacao/drawing-task';
import { obterTarefa } from '@/features/avaliacao/tarefas';
import { useConsentGate } from '@/features/avaliacao/use-consent-gate';

// Área de desenho de cada tarefa (#9). O relógio e o cubo já têm a tela de desenho;
// as trilhas ainda mostram o destino provisório da instrução (#8).
//
// O "Confirmar" abre a instrução da tarefa seguinte. O `replace` mantém o fluxo só
// para a frente: o paciente não volta a uma tarefa já confirmada.
export default function DrawingRoute() {
  const router = useRouter();
  const { atendimento, tarefa } = useLocalSearchParams<{ atendimento?: string; tarefa?: string }>();
  const escolhida = obterTarefa(tarefa);
  const acesso = useConsentGate(atendimento);

  useEffect(() => {
    if (acesso === 'aguardando_consentimento') {
      router.replace({ pathname: '/tcle', params: { atendimento: String(atendimento) } });
    } else if (acesso === 'bloqueado') {
      router.replace('/menu');
    }
  }, [acesso, atendimento, router]);

  if (acesso !== 'liberado') return null;
  if (!escolhida || !temTelaDeDesenho(escolhida)) return <DrawingPlaceholderScreen />;

  return (
    <DrawingTaskScreen
      tarefa={tarefa}
      atendimento={atendimento}
      onConfirmar={(confirmada) =>
        router.replace({
          pathname: '/instrucao',
          params: { atendimento: String(atendimento), tarefa: String(confirmada.numero + 1) },
        })
      }
    />
  );
}
