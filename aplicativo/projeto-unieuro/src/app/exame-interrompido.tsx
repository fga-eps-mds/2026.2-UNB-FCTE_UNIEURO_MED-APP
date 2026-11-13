import { useLocalSearchParams, useRouter } from 'expo-router';

import { credentialsRepository } from '@/features/auth/composition';
import { loadInterruptedExam, resumeExam } from '@/features/avaliacao/composition';
import ExameInterrompidoScreen from '@/features/avaliacao/exame-interrompido-screen';

// Tela depois da desistência (#25). A retomada abre a instrução da primeira
// tarefa sem desenho; o `replace` mantém o fluxo só para a frente.
export default function ExameInterrompidoRoute() {
  const router = useRouter();
  const { atendimento } = useLocalSearchParams<{ atendimento?: string }>();

  return (
    <ExameInterrompidoScreen
      atendimento={atendimento}
      repository={credentialsRepository}
      carregar={loadInterruptedExam}
      retomar={resumeExam}
      onRetomado={(tarefa) =>
        router.replace({
          pathname: '/instrucao',
          params: { atendimento: String(atendimento), tarefa: String(tarefa) },
        })
      }
    />
  );
}
