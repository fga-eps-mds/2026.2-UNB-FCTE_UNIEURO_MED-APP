import { useLocalSearchParams, useRouter } from 'expo-router';

import InstructionScreen from '@/features/avaliacao/instruction-screen';

// Instrução de cada desenho (#8). O toque em "Começar" segue para a área de
// desenho. O `replace` mantém o fluxo só para a frente: o paciente não volta à
// instrução com o botão voltar.
export default function InstructionRoute() {
  const router = useRouter();
  const { atendimento, tarefa } = useLocalSearchParams<{ atendimento?: string; tarefa?: string }>();

  return (
    <InstructionScreen
      tarefa={tarefa}
      atendimento={atendimento}
      onStart={(escolhida) =>
        router.replace({
          pathname: '/desenho',
          params: { atendimento: String(atendimento), tarefa: String(escolhida.numero) },
        })
      }
    />
  );
}
